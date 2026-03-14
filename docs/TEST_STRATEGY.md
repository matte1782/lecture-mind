# VL-JEPA Lecture Summarizer — Test Strategy v1.1

**Date:** 2024-12-31
**Author:** QA_LEAD
**Status:** PROPOSED
**Prerequisites:** SPECIFICATION.md v1.0 (APPROVED), TEST_MATRIX.md v1.0

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Testing Principles](#2-testing-principles)
3. [Test Requirement Traceability](#3-test-requirement-traceability)
4. [Test Categories](#4-test-categories)
5. [Invariant Testing](#5-invariant-testing)
6. [Security Testing](#6-security-testing)
7. [Failure Mode Testing](#7-failure-mode-testing)
8. [ML Reproducibility](#8-ml-reproducibility)
9. [Test Infrastructure](#9-test-infrastructure)
10. [Test Data Management](#10-test-data-management)
11. [GPU Testing Strategy](#11-gpu-testing-strategy)
12. [Regression Testing](#12-regression-testing)
13. [CI/CD Pipeline](#13-cicd-pipeline)
14. [Quality Gates](#14-quality-gates)
15. [Test Execution](#15-test-execution)
16. [Approval Status](#16-approval-status)

---

## 1. Executive Summary

This document defines the comprehensive testing strategy for the VL-JEPA Lecture Summarizer. It establishes testing principles, methodologies, infrastructure requirements, and quality gates that ensure the system meets all 74 test requirements from SPECIFICATION.md and validates all 17 invariants from ARCHITECTURE.md.

**Test Totals:**
- Unit Tests: 48
- Property Tests: 14
- Integration Tests: 10
- Benchmark Tests: 11
- **Total: 83 tests**

---

## 2. Testing Principles

### 2.1 Core Principles

| Principle | Description | Enforcement |
|:----------|:------------|:------------|
| **Test-First** | Tests written before implementation | Code review gate |
| **Specification Traceability** | Every test maps to SPEC_ID via `IMPLEMENTS` comment | Test docstrings |
| **Invariant Coverage** | All 17 invariants have property tests | TEST_MATRIX.md verification |
| **Fail Fast** | Critical paths tested first | Priority ordering |
| **Reproducibility** | All tests deterministic with seeding | `RANDOM_SEED=42` fixture |
| **ML Determinism** | Seed everything, log configs | `torch.manual_seed`, config capture |

### 2.2 Testing Pyramid

```
                    ┌─────────────────┐
                    │   E2E Tests     │  3 tests (Gradio app)
                    │   (Manual)      │
                    ├─────────────────┤
                    │  Integration    │  10 tests
                    │    Tests        │
              ┌─────┴─────────────────┴─────┐
              │       Property Tests         │  14 tests
              │     (Hypothesis-based)       │
        ┌─────┴───────────────────────────────┴─────┐
        │              Unit Tests                    │  48 tests
        │         (Fast, Isolated)                   │
        └───────────────────────────────────────────────┘

        ┌───────────────────────────────────────────────┐
        │           Benchmark Tests                      │  11 tests
        │        (Performance validation)                │
        └───────────────────────────────────────────────┘
```

---

## 3. Test Requirement Traceability

### 3.1 Complete Test Requirement Matrix

All 74 test requirements from SPECIFICATION.md are covered:

| SPEC | Component | Test IDs | Count | Status |
|:-----|:----------|:---------|:------|:-------|
| S001 | Video File | T001.1-T001.8 | 8 | STUBS |
| S002 | Stream | T002.1-T002.3 | 3 | STUBS |
| S003 | Frame Sampler | T003.1-T003.8 | 8 | STUBS |
| S004 | Visual Encoder | T004.1-T004.10 | 10 | STUBS |
| S005 | Event Detector | T005.1-T005.8 | 8 | STUBS |
| S006 | Text Encoder | T006.1-T006.8 | 8 | STUBS |
| S007 | Embedding Index | T007.1-T007.10 | 10 | STUBS |
| S008 | Y-Decoder | T008.1-T008.6 | 6 | STUBS |
| S009 | Storage | T009.1-T009.6 | 6 | STUBS |
| S010 | Batch Processing | T010.1-T010.4 | 4 | STUBS |
| S011 | Query Pipeline | T011.1-T011.3 | 3 | STUBS |
| S012 | CLI | T012.1-T012.3 | 3 | STUBS |
| S013 | Gradio | T013.1-T013.3 | 3 | STUBS |
| **TOTAL** | | | **80** | **STUBS** |

### 3.2 Test Docstring Format (MANDATORY)

Every test MUST include traceability comments:

```python
def test_visual_encoder_batch_normalization() -> None:
    """
    Verify that visual encoder outputs are L2-normalized.

    IMPLEMENTS: S004
    TEST_ID: T004.2
    INVARIANT: INV006

    Given:
        - Batch of random frames (B, 3, 224, 224)
    When:
        - Encoder processes the batch
    Then:
        - All output embeddings have L2 norm ≈ 1.0

    Edge cases:
        - Single frame batch
        - Maximum batch size (16)
    """
    # Test implementation
    encoder = create_mock_encoder()
    frames = create_sample_frames(batch_size=4)
    embeddings = encoder.encode(frames)

    for i, emb in enumerate(embeddings):
        norm = np.linalg.norm(emb)
        assert 0.99 < norm < 1.01, \
            f"Embedding {i} L2 norm {norm:.4f} not in [0.99, 1.01]"
```

---

## 4. Test Categories

### 4.1 Unit Tests (48 tests)

**Purpose:** Verify individual components in isolation.

**Characteristics:**
- Fast execution (<100ms per test)
- No external dependencies (mocked)
- No GPU required
- No network access

**Mocking Strategy:**

| Component | Mock Strategy | Library |
|:----------|:--------------|:--------|
| V-JEPA Encoder | `MockVisualEncoder` returning seeded L2-normalized vectors | `unittest.mock` |
| MiniLM Encoder | `MockTextEncoder` returning seeded L2-normalized vectors | `unittest.mock` |
| Gemma-2B | `MockDecoder` returning fixed template strings | `unittest.mock` |
| Video Files | Synthetic numpy arrays via `conftest.py` fixtures | Native |
| FAISS Index | Real FAISS (lightweight, fast) | Real |
| SQLite | In-memory `:memory:` database | Real |

**Mock Boundary Rules:**
- Models are ALWAYS mocked in unit tests
- Storage is real but in-memory
- Video I/O is mocked with synthetic frames
- Mock verification required: `assert mock.called` or `assert_called_with()`

**Coverage Targets (aligned with TEST_MATRIX.md):**

| Metric | Target | Measurement |
|:-------|:-------|:------------|
| Line Coverage | >90% | `pytest-cov` |
| Branch Coverage | >85% | `pytest-cov` |
| Function Coverage | 100% | `pytest-cov` |

### 4.2 Property Tests (14 tests)

**Purpose:** Verify system invariants hold across all possible inputs.

**Framework:** Hypothesis 6.0+

**Properties Tested:**

| Test | Property | Hypothesis Strategy |
|:-----|:---------|:--------------------|
| `test_inv001_timestamps` | Timestamps monotonically increasing | `@given(lists(floats(min_value=0)))` |
| `test_inv002_buffer` | Frame buffer ≤ 10 | `@given(integers(1, 100))` FPS values |
| `test_inv003_frame_size` | Frame size 224x224x3 | `@given(arrays(np.uint8, (st.integers(1,4000), st.integers(1,4000), 3)))` |
| `test_inv004_pixel_range` | Pixels in [-1, 1] | `@given(arrays(np.float32, (224,224,3)))` |
| `test_inv005_embedding_dim` | Embedding dim = 768 | `@given(integers(1, 64))` batch sizes |
| `test_inv006_l2_norm` | L2-normalized embeddings | `@given(arrays())` + norm check |
| `test_inv007_events_nonoverlapping` | Events non-overlapping | `@given(lists(floats()))` timestamps |
| `test_inv008_confidence_bounds` | Confidence in [0, 1] | `@given(floats(0, 2))` raw values |
| `test_inv009_query_dim` | Query dim = 768 | `@given(text())` queries |
| `test_inv010_query_l2_norm` | Query L2-normalized | `@given(text())` + norm check |
| `test_inv011_index_contains_all` | Index contains all embeddings | `@given(lists(arrays()))` |
| `test_inv012_search_returns_k` | Search returns ≤ k | `@given(integers(1, 1000))` k values |
| `test_inv013_output_length` | Output ≤ 150 tokens | `@given(text())` prompts |
| `test_inv014_timeout` | Generation within timeout | Mock time |
| `test_inv015_atomic_writes` | Writes are atomic | Crash simulation |
| `test_inv016_crash_survival` | Data survives crash | Signal injection |
| `test_inv017_batch_memory` | Batch size ≤ memory | `@given(integers())` memory |

### 4.3 Integration Tests (10 tests)

**Purpose:** Verify component interactions and external interfaces.

**Environment:**
- Docker container for isolation
- Mock models (real weights too large for CI)
- Real FAISS, SQLite, file I/O
- No network access

**Mocking Boundaries:**

| Component | Status | Justification |
|:----------|:-------|:--------------|
| V-JEPA weights | MOCKED | 1.2GB too large for CI |
| MiniLM weights | REAL | 90MB acceptable |
| Gemma-2B weights | MOCKED | 2GB too large |
| Video decode | REAL | OpenCV is fast |
| FAISS | REAL | Required for search |
| SQLite | REAL | Required for storage |

**Test Categories:**

| Category | Tests | Requirements |
|:---------|:------|:-------------|
| Video Processing | 2 | Sample video files (tests/data/videos/) |
| Storage Recovery | 1 | Crash simulation via signal |
| Query Pipeline | 3 | Full flow with mock encoders |
| CLI E2E | 1 | Subprocess testing |
| Gradio App | 3 | Selenium/Playwright |

### 4.4 Benchmark Tests (11 tests)

**Purpose:** Validate performance meets ARCHITECTURE.md budgets.

**Performance Budgets (EXACT MATCH with ARCHITECTURE.md):**

| Component | Metric | CPU Target | GPU Target | TEST_ID |
|:----------|:-------|:-----------|:-----------|:--------|
| Frame Sampler | Resize latency | <20ms | N/A | T003.8 |
| Visual Encoder | Encode latency | <200ms | <50ms | T004.9, T004.10 |
| Event Detector | Detection latency | <10ms | N/A | T005.8 |
| Text Encoder | Encode latency | <50ms | N/A | T006.8 |
| Embedding Index | Search 10k | <10ms | N/A | T007.9 |
| Embedding Index | Search 100k | <100ms | N/A | T007.10 |
| Y-Decoder | Generation | <30s | <5s | T008.5, T008.6 |
| Query Pipeline | E2E latency | <100ms | N/A | T011.3 |
| Memory | 2hr lecture | <4GB | <4GB | (implicit) |

---

## 5. Invariant Testing

### 5.1 Complete Invariant Coverage

All 17 invariants from ARCHITECTURE.md have explicit tests:

| INV_ID | Statement | Property Test | Unit Test |
|:-------|:----------|:--------------|:----------|
| INV001 | Timestamps monotonically increasing | `test_inv001_timestamps` | T001.5 |
| INV002 | Frame buffer ≤ 10 | `test_inv002_buffer` | T001.6 |
| INV003 | Frame size 224x224x3 | `test_inv003_frame_size` | T003.1 |
| INV004 | Pixels in [-1, 1] | `test_inv004_pixel_range` | T003.2 |
| INV005 | Embedding dim = 768 | `test_inv005_embedding_dim` | T004.1 |
| INV006 | L2-normalized embeddings | `test_inv006_l2_norm` | T004.2 |
| INV007 | Events non-overlapping | `test_inv007_events_nonoverlapping` | T005.4 |
| INV008 | Confidence in [0, 1] | `test_inv008_confidence_bounds` | T005.5 |
| INV009 | Query dim = 768 | `test_inv009_query_dim` | T006.1 |
| INV010 | Query L2-normalized | `test_inv010_query_l2_norm` | T006.2 |
| INV011 | Index contains all embeddings | `test_inv011_index_contains_all` | T007.1-T007.2 |
| INV012 | Search returns ≤ k | `test_inv012_search_returns_k` | T007.3 |
| INV013 | Output ≤ 150 tokens | `test_inv013_output_length` | T008.3 |
| INV014 | Generation within timeout | `test_inv014_timeout` | T008.4 |
| INV015 | Atomic writes | `test_inv015_atomic_writes` | T009.1-T009.2 |
| INV016 | Crash survival | `test_inv016_crash_survival` | T009.4-T009.6 |
| INV017 | Batch size ≤ memory | `test_inv017_batch_memory` | T010.1 |

---

## 6. Security Testing

### 6.1 Security Test Requirements

Per ARCHITECTURE.md Section 7 (Security Considerations):

| Security Requirement | Test Type | Test Description |
|:---------------------|:----------|:-----------------|
| Local-only processing | Integration | Verify no network calls during processing |
| No telemetry | Unit | Mock socket, verify no outbound connections |
| User data isolation | Unit | Verify temp files cleaned on exit |
| Model integrity | Unit | Verify checksum validation of model weights |
| Input validation | Unit | Path traversal attacks blocked |
| Query sanitization | Unit | Max length enforced, injection prevented |

### 6.2 Security Test Implementation

```python
# tests/security/test_network_isolation.py
import socket
from unittest.mock import patch

def test_no_network_calls_during_processing() -> None:
    """
    SECURITY: Verify no network calls are made during video processing.

    IMPLEMENTS: Security Requirement - Local-only processing
    """
    original_socket = socket.socket

    network_calls: list[tuple[str, int]] = []

    def tracking_socket(*args, **kwargs):
        sock = original_socket(*args, **kwargs)
        original_connect = sock.connect

        def tracking_connect(address):
            network_calls.append(address)
            return original_connect(address)

        sock.connect = tracking_connect
        return sock

    with patch('socket.socket', tracking_socket):
        # Process a video
        from vl_jepa import process_video
        process_video("tests/data/videos/sample_30s.mp4")

    assert len(network_calls) == 0, \
        f"Unexpected network calls: {network_calls}"
```

### 6.3 Input Validation Tests

```python
# tests/security/test_input_validation.py
import pytest

def test_path_traversal_blocked() -> None:
    """
    SECURITY: Verify path traversal attacks are blocked.

    IMPLEMENTS: Security Requirement - Input validation
    """
    from vl_jepa.video import VideoInput

    malicious_paths = [
        "../../../etc/passwd",
        "..\\..\\windows\\system32",
        "/dev/null",
        "file:///etc/passwd",
    ]

    for path in malicious_paths:
        with pytest.raises(ValueError, match="Invalid path"):
            VideoInput(path)


def test_query_length_enforced() -> None:
    """
    SECURITY: Verify query length limits are enforced.

    IMPLEMENTS: Security Requirement - Query sanitization
    """
    from vl_jepa.retrieval import QueryEncoder

    encoder = QueryEncoder()
    long_query = "a" * 10000  # Exceeds 256 token limit

    # Should truncate, not crash
    embedding = encoder.encode(long_query)
    assert embedding.shape == (768,)
```

---

## 7. Failure Mode Testing

### 7.1 Failure Mode Coverage

Per ARCHITECTURE.md Section 6 (Failure Modes):

| Failure Mode | Test | Expected Behavior |
|:-------------|:-----|:------------------|
| GPU not available | `test_fm_gpu_fallback` | Fall back to CPU |
| Model file missing | `test_fm_model_missing` | Raise `ModelLoadError` with download URL |
| Out of memory | `test_fm_oom_recovery` | Reduce batch size, retry |
| Video decode fails | `test_fm_video_decode_error` | Skip frame, continue, log warning |
| Index corrupted | `test_fm_index_corruption` | Rebuild from embeddings |
| Storage full | `test_fm_storage_full` | Alert user, stop ingestion gracefully |

### 7.2 Failure Mode Test Implementation

```python
# tests/failure_modes/test_graceful_degradation.py
import pytest
from unittest.mock import patch, MagicMock

def test_fm_gpu_fallback() -> None:
    """
    FAILURE_MODE: GPU not available -> Fall back to CPU.

    IMPLEMENTS: FM001
    """
    with patch('torch.cuda.is_available', return_value=False):
        from vl_jepa.encoders import PlaceholderVisualEncoder

        encoder = PlaceholderVisualEncoder(device="auto")

        # Should detect no GPU and use CPU
        assert encoder.device.type == "cpu"


def test_fm_model_missing() -> None:
    """
    FAILURE_MODE: Model file missing -> Raise with download URL.

    IMPLEMENTS: FM002
    """
    from vl_jepa.encoders import PlaceholderVisualEncoder
    from vl_jepa.encoders import DINOv2LoadError

    with pytest.raises(DINOv2LoadError) as exc_info:
        PlaceholderVisualEncoder(checkpoint_path="/nonexistent/model.safetensors")

    assert "download" in str(exc_info.value).lower()
    assert "https://" in str(exc_info.value)


def test_fm_oom_recovery() -> None:
    """
    FAILURE_MODE: Out of memory -> Reduce batch size and retry.

    IMPLEMENTS: FM003
    """
    from vl_jepa.batch import BatchProcessor

    processor = BatchProcessor(initial_batch_size=16)

    # Simulate OOM on first attempt
    with patch.object(processor, '_process_batch') as mock_process:
        mock_process.side_effect = [
            RuntimeError("CUDA out of memory"),  # First attempt fails
            None,  # Retry with smaller batch succeeds
        ]

        processor.process(frames=[...])

        # Should have retried with smaller batch
        assert mock_process.call_count == 2
        second_call_batch = mock_process.call_args_list[1][0][0]
        assert len(second_call_batch) < 16
```

---

## 8. ML Reproducibility

### 8.1 Reproducibility Requirements

Per CLAUDE.md: "Reproducibility: Seed everything, log configs"

| Requirement | Implementation | Verification |
|:------------|:---------------|:-------------|
| Random seeds | `RANDOM_SEED=42` constant | Fixture in conftest.py |
| PyTorch seeds | `torch.manual_seed(42)` | Before every test |
| NumPy seeds | `np.random.seed(42)` | Before every test |
| Config logging | JSON config written to `test_outputs/` | Assertion in teardown |
| Deterministic ordering | `pytest --randomly-seed=42` | CI flag |

### 8.2 Reproducibility Fixture

```python
# conftest.py
import os
import random
import numpy as np
import torch
import pytest

RANDOM_SEED = 42

@pytest.fixture(autouse=True)
def seed_everything():
    """Ensure reproducible tests by seeding all random sources."""
    random.seed(RANDOM_SEED)
    np.random.seed(RANDOM_SEED)
    torch.manual_seed(RANDOM_SEED)
    if torch.cuda.is_available():
        torch.cuda.manual_seed_all(RANDOM_SEED)
        torch.backends.cudnn.deterministic = True
        torch.backends.cudnn.benchmark = False
    os.environ["PYTHONHASHSEED"] = str(RANDOM_SEED)
    yield


@pytest.fixture
def config_logger(tmp_path):
    """Log test configuration for reproducibility."""
    import json

    config = {
        "random_seed": RANDOM_SEED,
        "torch_version": torch.__version__,
        "numpy_version": np.__version__,
        "cuda_available": torch.cuda.is_available(),
    }

    config_path = tmp_path / "test_config.json"
    with open(config_path, "w") as f:
        json.dump(config, f, indent=2)

    yield config

    # Verify config was logged
    assert config_path.exists()
```

### 8.3 CPU/GPU Equivalence Testing

```python
# tests/ml/test_cpu_gpu_equivalence.py
import pytest
import numpy as np
import torch

@pytest.mark.gpu
def test_encoder_cpu_gpu_equivalence() -> None:
    """
    ML_REPRODUCIBILITY: Verify CPU and GPU produce equivalent results.

    Note: Floating point differences expected, tolerance is 1e-5.
    """
    if not torch.cuda.is_available():
        pytest.skip("GPU not available")

    from vl_jepa.encoders import PlaceholderVisualEncoder

    # Same input
    frames = torch.randn(4, 3, 224, 224)

    # CPU inference
    encoder_cpu = PlaceholderVisualEncoder(device="cpu")
    embeddings_cpu = encoder_cpu.encode(frames)

    # GPU inference
    encoder_gpu = PlaceholderVisualEncoder(device="cuda")
    embeddings_gpu = encoder_gpu.encode(frames.cuda()).cpu()

    # Compare
    np.testing.assert_allclose(
        embeddings_cpu.numpy(),
        embeddings_gpu.numpy(),
        rtol=1e-5,
        atol=1e-5,
        err_msg="CPU and GPU embeddings differ beyond tolerance"
    )
```

---

## 9. Test Infrastructure

### 9.1 Fixtures

```python
# conftest.py
import pytest
import numpy as np
from pathlib import Path
from typing import Generator

RANDOM_SEED = 42

@pytest.fixture(scope="session")
def random_generator() -> np.random.Generator:
    """Reproducible random generator."""
    return np.random.default_rng(RANDOM_SEED)

@pytest.fixture
def sample_frame(random_generator: np.random.Generator) -> np.ndarray:
    """Generate a synthetic 224x224 RGB frame."""
    return random_generator.random((224, 224, 3), dtype=np.float32) * 2 - 1

@pytest.fixture
def sample_embedding(random_generator: np.random.Generator) -> np.ndarray:
    """Generate a random L2-normalized 768-dim embedding."""
    vec = random_generator.random(768, dtype=np.float32)
    return vec / np.linalg.norm(vec)

@pytest.fixture
def mock_visual_encoder():
    """Mock V-JEPA encoder returning deterministic embeddings."""
    class MockEncoder:
        def __init__(self, seed: int = RANDOM_SEED):
            self.rng = np.random.default_rng(seed)

        def encode(self, frames: np.ndarray) -> np.ndarray:
            batch_size = frames.shape[0]
            embeddings = self.rng.random((batch_size, 768), dtype=np.float32)
            norms = np.linalg.norm(embeddings, axis=1, keepdims=True)
            return embeddings / norms

    return MockEncoder()

@pytest.fixture
def temp_data_dir(tmp_path: Path) -> Path:
    """Create temporary directory with proper structure."""
    (tmp_path / "embeddings").mkdir()
    (tmp_path / "metadata").mkdir()
    return tmp_path

@pytest.fixture
def sample_video_path() -> Path:
    """Path to sample test video."""
    path = Path(__file__).parent / "data" / "videos" / "sample_30s.mp4"
    if not path.exists():
        pytest.skip("Sample video not available")
    return path
```

### 9.2 Test Markers

```python
# pyproject.toml
[tool.pytest.ini_options]
markers = [
    "unit: Unit tests (fast, isolated)",
    "property: Property-based tests (Hypothesis)",
    "integration: Integration tests (may require resources)",
    "benchmark: Performance benchmarks",
    "slow: Tests taking >10 seconds",
    "gpu: Tests requiring CUDA GPU",
    "network: Tests requiring network access",
    "security: Security-focused tests",
    "failure_mode: Failure mode testing",
    "skip_ci: Skip in CI environment",
]
testpaths = ["tests"]
python_files = ["test_*.py"]
python_functions = ["test_*"]
addopts = "-v --tb=short"
```

### 9.3 Test Isolation

```python
# conftest.py
import pytest
import tempfile
import shutil

@pytest.fixture(autouse=True)
def isolate_tests(tmp_path: Path) -> Generator[None, None, None]:
    """Ensure each test runs in isolation."""
    # Set working directory to temp
    original_cwd = os.getcwd()
    os.chdir(tmp_path)

    # Clear any module caches
    import sys
    modules_before = set(sys.modules.keys())

    yield

    # Restore working directory
    os.chdir(original_cwd)

    # Clean up any temp files
    shutil.rmtree(tmp_path, ignore_errors=True)
```

---

## 10. Test Data Management

### 10.1 Test Data Storage

| Data Type | Location | Storage Method | Size Budget |
|:----------|:---------|:---------------|:------------|
| Sample videos | `tests/data/videos/` | Git LFS | 20MB total |
| Mock weights | `tests/data/models/` | Generated at test time | <1MB |
| Reference embeddings | `tests/data/embeddings/` | Git | <1MB |
| Generated fixtures | `tmp_path` (pytest) | Ephemeral | N/A |

### 10.2 Video Test Data

| File | Duration | Resolution | Purpose | Size |
|:-----|:---------|:-----------|:--------|:-----|
| `sample_30s.mp4` | 30s | 1280x720 | Standard lecture clip | ~5MB |
| `sample_empty.mp4` | 0s | N/A | Empty video edge case | <1KB |
| `sample_vfr.mp4` | 10s | 1920x1080 | Variable frame rate | ~3MB |
| `sample_corrupt.mp4` | 10s | 720x480 | Corrupted at frame 50 | ~2MB |
| `sample_grayscale.mp4` | 5s | 640x480 | Grayscale input | ~500KB |

### 10.3 Test Data Generation

```bash
# Generate test videos if not present
python scripts/generate_test_videos.py

# Validate test data
pytest tests/data/ --collect-only
```

---

## 11. GPU Testing Strategy

### 11.1 GPU Test Configuration

| Environment | GPU Tests | Runner |
|:------------|:----------|:-------|
| Local dev | Run if GPU available | Native |
| CI (GitHub Actions) | Skipped by default | `ubuntu-latest` |
| Nightly CI | Run on GPU runner | Self-hosted with CUDA |

### 11.2 GPU Test Markers

```python
@pytest.mark.gpu
def test_gpu_inference() -> None:
    """Requires CUDA GPU."""
    if not torch.cuda.is_available():
        pytest.skip("CUDA not available")
    ...
```

### 11.3 GPU Fallback Verification

```python
def test_automatic_gpu_fallback() -> None:
    """Verify system works when GPU is unavailable."""
    with patch('torch.cuda.is_available', return_value=False):
        from vl_jepa.encoders import PlaceholderVisualEncoder

        encoder = PlaceholderVisualEncoder(device="auto")
        result = encoder.encode(sample_frames)

        assert result.shape == (batch_size, 768)
```

---

## 12. Regression Testing

### 12.1 Regression Test Protocol

| Trigger | Tests Run | Comparison |
|:--------|:----------|:-----------|
| Every PR | Unit + Property | N/A |
| Merge to main | All tests | Baseline from main |
| Nightly | Full + Benchmarks | Previous nightly |
| Release | Full + Manual E2E | Previous release |

### 12.2 Performance Regression Detection

```yaml
# .github/workflows/benchmark.yml
- name: Run benchmarks
  run: pytest tests/benchmarks/ --benchmark-json=benchmark.json

- name: Compare with baseline
  run: |
    pytest-benchmark compare \
      benchmark.json baseline.json \
      --fail-on-change=10%
```

### 12.3 Regression Investigation

| Severity | Detection | Response |
|:---------|:----------|:---------|
| >25% slower | PR blocked | Must fix before merge |
| 10-25% slower | Warning | Document justification |
| <10% slower | Logged | Monitor trend |

---

## 13. CI/CD Pipeline

### 13.1 Pipeline Definition

```yaml
# .github/workflows/test.yml
name: Tests

on: [push, pull_request]

env:
  PYTHON_VERSION: "3.10"

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: ${{ env.PYTHON_VERSION }}
      - run: pip install ruff mypy
      - run: ruff check src/
      - run: mypy src/ --strict

  unit-tests:
    runs-on: ubuntu-latest
    needs: lint
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: ${{ env.PYTHON_VERSION }}
      - run: pip install -e ".[dev]"
      - run: pytest tests/unit/ -v --cov=vl_jepa --cov-report=xml --cov-fail-under=90
      - uses: codecov/codecov-action@v4

  property-tests:
    runs-on: ubuntu-latest
    needs: unit-tests
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: ${{ env.PYTHON_VERSION }}
      - run: pip install -e ".[dev]"
      - run: pytest tests/property/ -v --hypothesis-profile=ci

  integration-tests:
    runs-on: ubuntu-latest
    needs: property-tests
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: ${{ env.PYTHON_VERSION }}
      - run: pip install -e ".[dev]"
      - run: pytest tests/integration/ -v -m "not gpu and not network"

  security-tests:
    runs-on: ubuntu-latest
    needs: unit-tests
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: ${{ env.PYTHON_VERSION }}
      - run: pip install -e ".[dev]"
      - run: pytest tests/security/ -v

  benchmarks:
    runs-on: ubuntu-latest
    needs: integration-tests
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: ${{ env.PYTHON_VERSION }}
      - run: pip install -e ".[dev]"
      - run: pytest tests/benchmarks/ --benchmark-only --benchmark-json=benchmark.json
      - uses: benchmark-action/github-action-benchmark@v1
        with:
          tool: pytest
          output-file-path: benchmark.json
```

### 13.2 Artifact Retention

| Artifact | Retention | Purpose |
|:---------|:----------|:--------|
| Coverage reports | 30 days | Trend analysis |
| Benchmark results | 90 days | Performance tracking |
| Test logs | 7 days | Debugging |

---

## 14. Quality Gates

### 14.1 Gate Definitions

| Gate | Trigger | Requirements | Blocker |
|:-----|:--------|:-------------|:--------|
| **PR Gate** | Every PR | Unit tests pass, coverage >90%, lint clean | Merge blocked |
| **Main Gate** | Merge to main | All tests pass, benchmarks within budget | Deploy blocked |
| **Release Gate** | Version tag | Full suite + manual E2E + security scan | Release blocked |

### 14.2 Coverage Configuration

```toml
# pyproject.toml
[tool.coverage.run]
branch = true
source = ["src/vl_jepa"]
omit = ["*/tests/*", "*/__init__.py"]

[tool.coverage.report]
fail_under = 90
exclude_lines = [
    "pragma: no cover",
    "if TYPE_CHECKING:",
    "raise NotImplementedError",
    "@abstractmethod",
]
```

### 14.3 Benchmark Regression Rules

| Metric | Threshold | Action |
|:-------|:----------|:-------|
| Mean latency increase | >10% | Warning in PR |
| Mean latency increase | >25% | PR blocked |
| P99 latency increase | >50% | Investigation required |

---

## 15. Test Execution

### 15.1 Local Development

```bash
# Run all unit tests (fast feedback)
pytest tests/unit/ -v

# Run with coverage
pytest tests/unit/ --cov=vl_jepa --cov-report=html
open htmlcov/index.html

# Run property tests (quick profile)
pytest tests/property/ -v --hypothesis-profile=dev

# Run specific test by ID
pytest -k "T001.1" -v

# Run tests for specific spec
pytest -k "S001" -v

# Skip slow tests
pytest -m "not slow"

# Run only GPU tests
pytest -m "gpu"

# Run security tests
pytest tests/security/ -v

# Run failure mode tests
pytest tests/failure_modes/ -v
```

### 15.2 Pre-Commit Checks

```bash
# Fast validation (unit + lint)
pytest tests/unit/ -x -q && ruff check src/ && mypy src/ --strict

# Full validation (before PR)
pytest --cov=vl_jepa --cov-fail-under=90
```

### 15.3 Test Prioritization

| Priority | Category | When to Run |
|:---------|:---------|:------------|
| P0 | Smoke tests | Every save (watch mode) |
| P1 | Unit tests | Every commit |
| P2 | Property tests | Every PR |
| P3 | Integration tests | Pre-merge |
| P4 | Benchmarks | Nightly / Release |

---

## 16. Approval Status

| Reviewer | Verdict | Date | Notes |
|:---------|:--------|:-----|:------|
| HOSTILE_REVIEWER | [PENDING] | | |

---

## 17. Revision History

| Version | Date | Changes |
|:--------|:-----|:--------|
| 1.0 | 2024-12-31 | Initial test strategy |
| 1.1 | 2024-12-31 | Added: Security Testing (Section 6), Failure Mode Testing (Section 7), ML Reproducibility (Section 8), GPU Testing (Section 11), Regression Testing (Section 12), CI/CD Pipeline (Section 13), Complete invariant coverage (Section 5), Test traceability (Section 3) |

---

*Test Strategy Version: 1.1*
*Author: QA_LEAD*
*Project: VL-JEPA Lecture Summarizer*
