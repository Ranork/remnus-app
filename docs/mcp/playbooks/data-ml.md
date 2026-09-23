# Playbook: Data / ML

What an agent looks for and models when calibrating a data or ML project: datasets, experiments, models, data-quality issues.

For [Calibrate](../calibrate.md), Phase 2b. Index: [Playbooks](../playbooks.md).

**Evidence first.** This playbook is a list of things to look for, not a template: no
database, column or row gets created unless this project's code, docs or history shows it.

## Pick it when

Data or modelling work is the product, not a side script: `*.ipynb` or `notebooks/`;
`pandas`, `polars`, `scikit-learn`, `torch`, `tensorflow`, `transformers`, `xgboost`,
`lightgbm` in the Python manifest; pipeline or tracking config — `dvc.yaml`,
`dbt_project.yml`, `dags/` (Airflow), `prefect`, `dagster`, `mlflow`, `wandb`; folders
such as `data/raw`, `data/processed`, `models/`.

## Concepts to model

**Datasets** (`conceptType: dataset`) — sources and derived tables. `Origin` text ·
`Format` select (`CSV`, `Parquet`, `Table`, `API`) · `Refresh` select (`One-off`, `Daily`,
`Weekly`, `Streaming`) · `Contains PII` checkbox · `Location` text (path or table name,
never credentials).

**Experiments** (`experiment`) — the runs that changed a decision, not every run.
`Model` select · `Dataset` text · `Metric` select (`AUC`, `F1`, `RMSE`…) · `Score` number
· `Date` date · `Outcome` select (`Baseline`, `Promising`, `Rejected`, `Shipped`).

**Models** (`model`) — only when something is trained and used. `Version` text · `Stage`
status (`Training` → `Staging` → `Production`, `Archived`) · `Score` number · `Deployed`
date.

**Data-quality issues** (`data-quality`) — only with evidence: validation code, a fix
commit, a note. `Dataset` text · `Severity` select (`Breaks model`, `Skews results`,
`Cosmetic`) · `Status` status (`Open` → `Handled`) · `Found` date.

## Example rows

- **Datasets** — *orders_clean* · Origin `dbt: stg_orders` · Format `Table` · Refresh
  `Daily` · Contains PII unchecked. Body: "One row per paid order; refunds are negative rows,
  not updates. Test orders removed by `is_test = false` — the raw table still has them."
- **Experiments** — *Gradient boosting on 90-day window* · Model `LightGBM` · Metric `AUC`
  · Score 0.81 · Outcome `Shipped`. Body: "Beat the logistic baseline (0.74) once
  `days_since_last_order` was capped at 365; longer windows added noise. Run in the
  tracker: link."

## Status screen

`Model status`:
- `metric` Experiments, trend on Date over 30 days
- `chart` line, Experiments grouped by Date, bucket week
- `list` Experiments, sort Score descending, showColumns Model, Score, Outcome
- `metric` Models, filter Stage equals `Production`, unit "live"
- `list` Data-quality issues, filter Status equals `Open`, showColumns Dataset, Severity
- `links` overview, Datasets, Decisions

## Don't

- Paste notebook outputs, metric tables or plots into pages. Write the conclusion and
  link the notebook in `sources`.
- Log every run when a tracker already has them — keep the runs that changed a decision.
- Copy sample rows from the data: they can hold personal information.
