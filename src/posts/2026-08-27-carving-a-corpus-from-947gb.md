---
title: Carving a research corpus out of 947 GB
date: 2026-08-27
description: Using DuckDB to select and download just the books you need from Institutional Books, without pulling the whole dataset.
tags: ["posts"]
---

[Institutional Books 1.0](https://huggingface.co/datasets/institutional/institutional-books-hl)
is a remarkable thing: 983,004 public-domain books digitised from Harvard Library,
OCR'd, cleaned, and released for research. It is also **about 947 GB of text**, spread
across 9,831 Parquet files. If your question is "what did people write about the Ballets
Russes," you do not want 947 GB. You want maybe fifty books.

This post walks through a pattern for getting exactly those fifty, using
[DuckDB](https://duckdb.org/) to filter a small metadata file *before* touching the
large one. There's a companion notebook you can run in Colab:

<p class="cta">
  <a class="button" href="https://colab.research.google.com/github/PULdischo/discho-blog/blob/main/src/assets/notebooks/institutional-books-duckdb.ipynb">Open the notebook in Colab</a>
  <a class="button" href="/assets/notebooks/institutional-books-duckdb.ipynb">Download the .ipynb</a>
</p>

## Three datasets, one join key

The Institutional Data Initiative publishes the collection in three forms. Picking the
right one matters.

| dataset | size | what's in it |
|---|---|---|
| [`…-hl-metadata`](https://huggingface.co/datasets/institutional/institutional-books-hl-metadata) | **306 MB**, one Parquet file, **not gated** | one row per book: title, author, date, language, Library of Congress subjects, OCR quality, token counts — **no text** |
| [`…-hl`](https://huggingface.co/datasets/institutional/institutional-books-hl) | **~947 GB**, 9,831 shards, gated | the same metadata **plus** page-by-page OCR text (`text_by_page_src`, and a post-processed `text_by_page_gen` for English, German, French, Italian and Spanish) |
| [`…-hl-enriched-text`](https://huggingface.co/datasets/institutional/institutional-books-hl-enriched-text) | **~870 GB**, gated | text restructured into paragraphs, deduplicated and quality-filtered, with per-paragraph language tags |

Every row in all three carries `barcode_src`, the identifier that joins them. The
workflow is: **filter the 306 MB file, collect barcodes, fetch text for just those
barcodes.**

A note on the licence, because it shapes the ending: the metadata is open, but the
full-text datasets are released under the
[IDI Terms of Use](https://institutionaldatainitiative.org/) — noncommercial use only,
and **no redistributing the text** or derivatives that "substantially reproduce" it.

## How DuckDB reads a remote file without downloading it

DuckDB's `httpfs` extension speaks HTTP range requests. Point it at a Parquet URL and it
fetches the footer, figures out which row groups and columns your query actually needs,
and pulls only those byte ranges:

```python
import duckdb
con = duckdb.connect()
con.sql("INSTALL httpfs; LOAD httpfs;")

META = "hf://datasets/institutional/institutional-books-hl-metadata/data/train-00000-of-00001.parquet"

con.sql(f"""
    SELECT barcode_src, title_src, author_src, date1_src, language_gen
    FROM '{META}'
    WHERE language_gen = 'fra'
    LIMIT 5
""")
```

No `load_dataset`, no 306 MB download — a few MB move and the query returns in seconds.
The same code works on the 947 GB dataset; only the economics of what you ask for change.

## Knowing the corpus first

Before selecting anything, two quick queries tell you whether the corpus can answer your
question at all.

**A language census** is one `GROUP BY`:

```python
con.sql(f"""
    SELECT language_gen, count(*) AS n_books
    FROM '{META}'
    GROUP BY language_gen
    ORDER BY n_books DESC
""")
```

<!-- FIGURE: run notebook cell 2a, drop language-census.png here -->
![Bar chart of the fifteen most common detected languages in Institutional Books](/assets/images/institutional-books/language-census.png)

English dominates, then German and French; the tail runs to
**[[N_LANGUAGES]]** detected languages. A second query — comparing `language_src` (the
catalogue record) to `language_gen` (detected from the text) — shows the two disagree
for **[[PCT_LANG_DISAGREE]]%** of books, a useful reminder that "language" is a fuzzy
field for a multilingual collection.

**A date histogram** needs a little cleaning first, because `date1_src` is a MARC date
string full of `"18uu"` and blanks:

```python
con.sql(f"""
    SELECT TRY_CAST(date1_src AS INTEGER) AS year, count(*)
    FROM '{META}'
    WHERE regexp_full_match(date1_src, '\d{4}')
    GROUP BY year ORDER BY year
""")
```

<!-- FIGURE: run notebook cell 2c, drop corpus-dates.png here -->
![Histogram of publication years, concentrated between roughly 1800 and 1929](/assets/images/institutional-books/corpus-dates.png)

The collection is overwhelmingly the long 19th century up to the late 1920s — the
public-domain frontier. This is the single most important fact for choosing a topic. A
search for critical writing on "stream of consciousness" would come back nearly empty,
because the term enters criticism after 1930. The Ballets Russes — founded 1909,
Diaghilev dead by 1929 — sits right in the corpus's centre of mass.

## Example A: the entire Yiddish subset

The simplest kind of selection is a single column. How many Yiddish books are there, and
can we just have all of them?

First, don't guess the language code — Yiddish has three ISO 639-3 codes and detectors
disagree. Look:

```python
con.sql(f"""
    SELECT language_gen, count(*) FROM '{META}'
    WHERE language_gen LIKE 'y%' GROUP BY language_gen
""")
```

That yields **[[N_YIDDISH]]** books. To decide whether "download them all" is
reasonable, estimate the size: across the whole collection the text averages about
1 MB per book, so the Yiddish subset is roughly **[[GB_YIDDISH]] GB** — a rounding error
against 947 GB.

One caveat the query surfaces: the post-processed `text_by_page_gen` only exists for
five Western European languages. For Yiddish you get raw OCR (`text_by_page_src`), and
Yiddish is set in Hebrew script, which older OCR handles poorly — so check
`ocr_score_src` before trusting it. That is itself a finding worth putting in a
footnote.

## Example B: the Ballets Russes, in any language

Now the real thing. We want writing about Diaghilev's company and its dancers —
Nijinsky, Pavlova, Karsavina, Fokine — regardless of publication language.

There's no "ballet" column, so we cast a wide net across three fields, OR'd together:
title, subject headings, and author. The keyword list has to be multilingual and
allow for transliteration — `Nijinsky`, `Nijinski`, `Nizhinsky`, `Djagilew`,
`Ballets russes`, `Ballet Russe`:

```python
NAMES = ["Nijinsky", "Nijinski", "Nizhinsky", "Diaghilev", "Djagilew",
         "Pavlova", "Karsavina", "Fokine", "Ballets Russes", "Ballet Russe"]

def ilike_any(col, terms):
    return "(" + " OR ".join(f"{col} ILIKE '%' || $${t}$$ || '%'" for t in terms) + ")"

candidates = con.sql(f"""
    SELECT barcode_src, title_src, author_src, date1_src, language_gen,
           topic_or_subject_src
    FROM '{META}'
    WHERE {ilike_any('title_src', NAMES)}
       OR {ilike_any('topic_or_subject_src', SUBJECT_TERMS)}
       OR {ilike_any('author_src', AUTHOR_TERMS)}
""").df()
```

That returns **[[N_CANDIDATES]]** candidate books. Profiling them by language and
decade — before downloading a single page — confirms the shape:

<!-- FIGURE: run notebook cell 5b, drop ballets-russes-profile.png here -->
![Two bar charts: candidate books by language, and by decade, with a spike in the 1910s and 1920s](/assets/images/institutional-books/ballets-russes-profile.png)

French leads, then English and German, with the expected spike in the 1910s–20s. The
outliers — an 1870s book that matched "dance" — are exactly what the next step filters
out.

### Fetching only what we selected

With a few dozen barcodes, we query the 947 GB dataset directly:

```python
con.sql(f"""
    SELECT barcode_src, array_to_string(text_by_page_src, chr(10)) AS text
    FROM read_parquet('hf://datasets/institutional/institutional-books-hl/data/train-*.parquet')
    WHERE barcode_src IN ('{"', '".join(barcodes)}')
""")
```

The glob makes DuckDB read 9,831 file footers to plan the query — a few minutes — but it
then downloads only the matching row groups. Total transfer for the Ballets Russes
candidates: **[[MB_BALLETS]] MB**. The notebook also tests whether the metadata row
order lines up with the shard numbering; if it does, you can compute the exact shards
you need and skip the footer scan entirely.

### Checking that the selection is any good

A metadata match is a hypothesis. The notebook scores each book by how often the figures
are actually named in its text (`mentions_per_10k_words`), flags the ones that matched
only on a catalogue field and never in the body, and — optionally — sends the borderline
cases to Claude for a yes/no with a reason. What survives is a **[[N_FINAL]]-book**
corpus across **[[N_FINAL_LANGS]]** languages, deduplicated against the metadata's own
`likely_duplicates_barcodes_gen` list.

Then you can do the fun part — a keyword-in-context concordance across all of them at
once:

```
Работа Нижинского над ролью…              [rus, 1917]
…la révélation que fut Nijinsky dans…     [fra, 1912]
…Nijinsky's elevation and the way he…     [eng, 1913]
```

## Publishing the recipe, not the data

We can't redistribute the text. But we *can* publish everything needed to rebuild the
exact selection: the barcodes, the open metadata, and the relevance annotations we
computed. That goes to the Hub as a **manifest** —
[`apjanco/institutional-books-ballets-russes`](https://huggingface.co/datasets/apjanco/institutional-books-ballets-russes) —
with a `README` that carries a short rehydration script. Anyone who accepts the IDI
terms on the source dataset can reconstruct the full-text corpus from it in a couple of
minutes, and cite this manifest for provenance.

## The pattern

Independent of the topic:

1. **Filter small.** The 306 MB metadata answers "which books?" with no download and no
   token.
2. **Fetch narrow.** Range requests pull only the books you picked — megabytes, not
   gigabytes.
3. **Verify.** Check the metadata match against the actual text before trusting the
   corpus.
4. **Publish the recipe.** A manifest of identifiers plus your annotations is
   reproducible and shareable where the text itself is not.

<p class="colophon">
Full, runnable code is in the
<a href="/assets/notebooks/institutional-books-duckdb.ipynb">companion notebook</a>.
</p>
