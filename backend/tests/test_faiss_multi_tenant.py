import uuid
import numpy as np
import pytest
from app.services.faiss_index import (
    build_institution_index,
    search_institution,
    get_active_indices_telemetry,
    clear_all,
)


def test_per_tenant_faiss_vector_isolation():
    """Verify that vector embeddings for Institution A are completely isolated from Institution B."""
    clear_all()

    inst_a = uuid.uuid4()
    inst_b = uuid.uuid4()
    student_a_id = uuid.uuid4()

    # Synthetic 512-dim face vector
    vec_a = np.random.randn(512).astype(np.float32)
    vec_a /= np.linalg.norm(vec_a)
    vec_a_bytes = vec_a.tobytes()

    # 1. Build index for Institution A with student A
    emb_id = uuid.uuid4()
    build_institution_index(inst_a, [(vec_a_bytes, student_a_id, emb_id)], force=True)

    # 2. Search for vector A within Institution A -> Must match student_a
    score_a, matched_id_a = search_institution(inst_a, vec_a_bytes, threshold=0.1)
    assert matched_id_a == student_a_id
    assert score_a is not None and score_a > 0.9

    # 3. Search for vector A within Institution B -> MUST return zero matches (None)!
    score_b, matched_id_b = search_institution(inst_b, vec_a_bytes, threshold=0.1)
    assert matched_id_b is None

    # 4. Check active index telemetry
    telemetry = get_active_indices_telemetry()
    inst_ids = [t["institution_id"] for t in telemetry]
    assert str(inst_a) in inst_ids
    assert str(inst_b) not in inst_ids
