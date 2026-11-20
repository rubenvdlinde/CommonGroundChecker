# Open-track benchmark

The open track rates maintainability against thresholds that anyone can check and regenerate. They come from a public benchmark of Common Ground and Developer Overheid repositories, with the benchmark method of Alves et al. The open track is not a SIG rating and does not predict one. The checker shows it next to the estimate, for information only (weight 0).

| file | what it is |
|---|---|
| `candidates.json` | the repositories considered, with where each was found, and the ones left out by kind |
| `measures/` | the raw measures of every candidate, written by `run.py` |
| `benchmark.json`, `benchmark.csv` | the repositories the thresholds come from: URL, commit, languages, code lines and why each is in |
| `../../src/lib/openModel/thresholds-<date>.json` | the thresholds the checker rates with |
| `run.py` | clones and measures the candidates |
| `derive.py` | selects the benchmark and derives the thresholds |
| `coupling/` | the coupling measures of every benchmark repository, written by `run.py --coupling-image` |
| `check_coupling.py`, `coupling.py`, `Dockerfile.coupling` | the coupling check's measure script (a copy of `scripts/coupling/check_coupling.py`, feat/open-track-coupling db1cde2), a wrapper that adds the fan-in histogram, and the image with its tools |

## Version 2026-11-18.2 (in use)

This version keeps the unit, duplication and benchmark figures of 2026-11-18 and adds coupling. Both files are in `src/lib/openModel/`, and `benchmark.json` belongs to the newer one.

Coupling was measured with the coupling check's tools: pdepend 3.0.0 (batches of at most 1,000 files, 1,536 MB each), grimp 3.18 with import-linter 2.15, and dependency-cruiser 17.4.3. Three repositories are left out of the three coupling properties because a language was not measured: ConductionNL/pipelinq, MinBZK/par-dpia-form and open-formulieren/open-forms-sdk. In each, the coupling check reports "no Python file sits in a package". That leaves 57 repositories.

| property | better | bounds | 5 stars | 4 stars | 3 stars | 2 stars |
|---|---|---|---|---|---|---|
| module coupling | lower | fan-in above 2 / 3 / 5 | 4.4 / 1.9 / 0.0% | 20.0 / 13.1 / 6.7% | 29.1 / 22.7 / 13.8% | 54.0 / 43.9 / 30.4% |
| component independence | higher | | at least 99.9% | 81.5% | 63.8% | 27.3% |
| component entanglement | lower | | at most 0.000 | 0.029 | 0.094 | 0.236 |

**Module coupling** is a risk profile. Its bounds come from the LOC-weighted fan-in distribution, at the 70, 80 and 90% points (Alves 2010 section IV and Table IV), and its star limits from Algorithm 1 (Alves 2011). Fan-in counts the distinct modules that depend on a module, and each module weighs its code lines. The bounds are far below SIG's 10 / 20 / 50, because in this benchmark at least 70% of the code sits in modules with at most two dependants.

**Component independence and entanglement** are one value per repository. Each is averaged over the languages, weighted by code lines, and calibrated with Algorithm 1 on that single value. For independence the value is negated first, so the limits are minimums.

**Ties in entanglement.** 15 of the 57 repositories have a violation degree of 0, so they cannot be split. 26% of the benchmark gets 5 stars there, against the 5% target; the other levels hold 9 / 30 / 30 / 5%.

**Coupling in the app.** The checker takes coupling from the coupling check's `openTrack.coupling` result, reading it by shape. Module coupling also needs a `moduleCoupling.fanInHistogram` per language, which the coupling check does not report yet; `coupling.py` shows the five lines that add it. Until then the app rates independence and entanglement, and reports module coupling as not measured.

## Version 2026-11-18

60 repositories, 2.4 million code lines in scope (PHP 1.15M, Vue 368k, TypeScript 349k, Python 346k, JavaScript 186k). Measured with lizard 1.24.3 and jscpd 5.4.2.

| property | moderate / high / very high risk | 5 stars | 4 stars | 3 stars | 2 stars |
|---|---|---|---|---|---|
| unit size | more than 29 / 42 / 71 lines | 4.9 / 3.3 / 0.0% | 26.1 / 14.3 / 5.3% | 37.0 / 24.3 / 11.1% | 60.2 / 46.7 / 33.4% |
| unit complexity | McCabe above 5 / 7 / 10 | 8.2 / 1.9 / 0.4% | 24.9 / 14.6 / 6.2% | 34.4 / 23.9 / 13.1% | 45.1 / 38.1 / 32.2% |
| unit interfacing | more than 2 / 3 / 4 parameters (80/90/95%) | 0.7 / 0.0 / 0.0% | 13.2 / 3.9 / 1.9% | 21.6 / 10.4 / 6.6% | 31.4 / 19.2 / 12.2% |
| duplication | duplicated lines (jscpd) | 1.1% | 4.2% | 8.6% | 34.8% |

The benchmark rates exactly 3 / 18 / 18 / 18 / 3 repositories at 5 to 1 stars on every property. A star level allows at most the listed share of unit code above each bound; below the 2-star limits is 1 star. This version did not calibrate module coupling or the component properties; 2026-11-18.2 adds them.

## Sources of the candidates

- **developer.overheid.nl Open Source Register.** Its API (`api.developer.overheid.nl/oss-register/v1`) needs an API key, so the 98 repositories of its public listing (`oss.developer.overheid.nl/repositories`) were read instead on 2026-11-18.
- **Common Ground component catalogue.** `componentencatalogus.commonground.nl` did not resolve on 2026-11-18, so its data could not be used. The GitHub organisations that build the Common Ground components stand in for it: maykinmedia, VNG-Realisatie, ConductionNL, OpenWebconcept, open-zaak and open-formulieren.
- ConductionNL/opencatalogi is in, although GitHub marks it a fork: its upstream OpenCatalogi/opencatalogi was last pushed in June 2025.

## Selection

1. GitHub's primary language is PHP, Python, JavaScript, TypeScript or Vue (the languages the checker measures); a licence is detected; not a fork, not archived, pushed since 2023-11-18; repository size at least 300 KB.
2. Left out by kind, listed with a reason under `excluded` in `candidates.json`: libraries and SDKs, design systems, websites and documentation, templates and proofs of concept, wrappers that package another project, skill packs and data repositories, internal tools.
3. At least 2,000 code lines in the checker's production scope (`derive.py`, `MIN_CODE_LOC`).
4. At most 12 repositories per owner, the ones with the most GitHub stars first, then the largest (`MAX_PER_OWNER`). Without it ConductionNL alone would be 20 of 68 repositories.

`benchmark.json` lists what was left out at steps 3 and 4.

## Method

**Measurement** (`scripts/open-track/measure.py`, which the checker runs too): the production scope and lizard reader of the maintainability estimate, so tests, generated and third-party code stay out. Per language the script writes a histogram of unit LOC per metric value. Duplication is one jscpd 5 run per language over that language's files, with 6 lines, 30 tokens and weak mode, using jscpd's own duplicated and total line counts. All languages of a repository are pooled.

**Risk thresholds** (Alves, Ypma and Visser 2010, [doi:10.1109/ICSM.2010.5609747](https://doi.org/10.1109/ICSM.2010.5609747)): section IV, steps 1 to 6 (Fig. 2). Every unit weighs its LOC as a share of its repository's unit LOC (step 2), the weights are summed per metric value (step 3), every repository weighs the same (step 4), and the thresholds are the metric values at 70, 80 and 90% of that weighted distribution (steps 5 and 6). Unit interfacing takes 80, 90 and 95%, as in section VIII and Table IV, because its values hardly vary below 80%. Two choices are ours: the weight is divided by the repository's unit LOC (the paper's worked example divides by the system's total LOC, while step 2 requires the ratios to sum to 100%), and each bound is at least one above the previous one, which the paper does not need.

**Star limits** (Alves, Correia and Visser 2011, [doi:10.1109/IWSM-MENSURA.2011.15](https://doi.org/10.1109/IWSM-MENSURA.2011.15)), `calibrate()` in `derive.py`:
- Profiles are cumulative: the share of code above each risk bound (section II-A2).
- Limits come from Algorithm 1 (section III-A), for each star level, best first:
  - Step through the sorted shares with one common index until enough repositories rate at that level or better (lines 7 to 12).
  - Then lower each share's limit as far as that still holds (lines 13 to 26).
- The partition is 5/30/30/30/5%, which section IV-B names as an option after Baggen et al. The paper's own example is uniform, 20/20/20/20/20.
- A repository's stars follow section III-B1: per share the strictest level whose limit it stays within, and the lowest of those. The continuous interpolation of section III-B2 is not used.
- Duplication is calibrated the same way, with one share.

The paper does not define the `distribution()` function of Algorithm 1. We read it as the number of repositories rated at that level or better, compared with the cumulative partition count, so that the per-level counts come out as the partition. Neither the paper nor the thesis (Alves 2012, section 3.3.1) mentions a tolerance, and none is used. Limits are taken from the observed shares rounded up to 4 decimals.

Sources read: the 2010 paper (author copy), the 2011 paper (`mensura11-alves.pdf` on Tiago Alves's University of Minho page, read through the Internet Archive) and the thesis "Benchmark-based Software Product Quality Evaluation" (2012, same page).

The previous derivation of this version used the common index alone, without the optimisation of lines 13 to 26, and 70/80/90% for unit interfacing. It spread the benchmark as 6.7/28.3/31.7/28.3/5% on unit size and 5/30/31.7/31.7/1.7% on complexity. The bounds and the duplication limits did not change, and neither did the stars of OpenRegister and Open Zaak.

## Regenerate

The tools must be exactly lizard 1.24.3 (`pip install lizard==1.24.3`) and jscpd 5.4.2 (`npm install jscpd@5.4.2`); `derive.py` refuses a benchmark measured with mixed versions.

Reproduce the published version from the pinned commits:

```bash
python3 scripts/open-benchmark/run.py /tmp/open-benchmark --pinned scripts/open-benchmark/benchmark.json --jscpd <path to jscpd>
python3 scripts/open-benchmark/derive.py /tmp/open-benchmark --date 2026-11-18 --out-dir /tmp/open-benchmark --thresholds-dir /tmp/open-benchmark
```

Measuring at the pinned commits gives the same measures; this was checked for three repositories (open-zaak, open-klant, plugin-pdc-base). Re-deriving from the committed measures needs no clones: `python3 scripts/open-benchmark/derive.py scripts/open-benchmark --date 2026-11-18`.

A new version measures the default branches as they are now:

```bash
python3 scripts/open-benchmark/run.py <work dir> --jscpd <path to jscpd>
python3 scripts/open-benchmark/derive.py <work dir> --date <today>
```

Coupling is measured at the pinned commits in containers of the coupling image:

```bash
docker build -t open-benchmark-coupling -f scripts/open-benchmark/Dockerfile.coupling scripts/open-benchmark
python3 scripts/open-benchmark/run.py <work dir> --pinned scripts/open-benchmark/benchmark.json --coupling-image open-benchmark-coupling --jobs 3
```

`derive.py` reads `<work dir>/coupling/` when it exists. Then point `src/lib/openModel/score.ts` at the new thresholds file and keep the old one. Every clone is shallow and blobless and is deleted after measuring.
