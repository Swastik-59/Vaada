# L3Cube-HingCorpus & HingLID Resource Layer

## 1. Academic Reference
- **Resource**: L3Cube-HingCorpus & L3Cube-HingLID
- **Authors**: Ravindra Nayak and Raviraj Joshi (L3Cube Pune)
- **Publication**: *L3Cube-HingCorpus and HingBERT: A Code Mixed Hindi-English Dataset and BERT Language Models*, WILDRE-6 / BSNLP at LREC 2022.
- **Repository**: [https://github.com/l3cube-pune/code-mixed-nlp](https://github.com/l3cube-pune/code-mixed-nlp)
- **Paper**: [https://aclanthology.org/2022.wildre-1.2/](https://aclanthology.org/2022.wildre-1.2/) | [https://arxiv.org/abs/2204.08398](https://arxiv.org/abs/2204.08398)

---

## 2. Purpose & Strict Scope Boundaries

> [!IMPORTANT]
> **Data Provenance Rule**:
> 1. **L3Cube-HingCorpus** is used exclusively as an academic reference dataset for **evaluating language identification (LID)**, **code-switching detection**, and **syntactic text normalization**.
> 2. **L3Cube data does NOT contain payment conversations.**
> 3. The full multi-gigabyte raw corpus is **not** bundled into the repository. Instead, this directory maintains metadata manifests, license notes, and a curated evaluation sample (`samples.json`).
> 4. All domain-specific payment recovery conversation data is authored separately under `data/domain/payment_hinglish/`.

---

## 3. Curated Evaluation Samples (`samples.json`)

Contains representative Roman Hindi, pure English, and code-mixed Hindi-English sentences used by `evaluate_hinglish.py` to benchmark language identification accuracy and code-switch detection rates.
