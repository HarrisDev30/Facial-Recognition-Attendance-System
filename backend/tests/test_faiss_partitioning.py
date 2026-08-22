import uuid
import numpy as np
import pytest
from app.models.institution import Institution
from app.models.organization import Organization, OrgType
from app.models.attendee import Attendee
from app.models.embedding import Embedding
from app.services.faiss_index import (
    build_institution_index,
    search_institution,
    batch_search_institution,
    ensure_institution_index_loaded,
    evict_idle_indices,
    get_active_indices_telemetry,
    clear_all,
)


@pytest.mark.asyncio
async def test_faiss_zero_cross_institution_matching(test_session):
    """
    CRITICAL BIOMETRIC TEST:
    Verifies that a student enrolled in Institution A can NEVER match when scanned
    under Institution B's attendance sessions.
    """
    clear_all()

    # 1. Create two distinct institutions
    inst_a = Institution(name="Cor Jesu College", code=f"cjc_{uuid.uuid4().hex[:6]}")
    inst_b = Institution(name="Ateneo de Davao", code=f"addu_{uuid.uuid4().hex[:6]}")
    test_session.add_all([inst_a, inst_b])
    await test_session.flush()

    # 2. Create organizations
    org_a = Organization(institution_id=inst_a.id, name="CJC CCIS", code="CJC_CCIS", org_type=OrgType.COLLEGE)
    org_b = Organization(institution_id=inst_b.id, name="AdDU CS", code="ADDU_CS", org_type=OrgType.COLLEGE)
    test_session.add_all([org_a, org_b])
    await test_session.flush()

    # 3. Create Student Alpha in Institution A and Student Beta in Institution B
    student_alpha = Attendee(
        institution_id=inst_a.id,
        organization_id=org_a.id,
        identifier="2024-0001",
        first_name="Alpha",
        last_name="Student",
    )
    student_beta = Attendee(
        institution_id=inst_b.id,
        organization_id=org_b.id,
        identifier="2024-0001", # Identical student ID number in different school!
        first_name="Beta",
        last_name="Student",
    )
    test_session.add_all([student_alpha, student_beta])
    await test_session.flush()

    # 4. Generate random normalized 512-d embeddings
    np.random.seed(42)
    vec_alpha_raw = np.random.randn(512).astype(np.float32)
    vec_alpha = vec_alpha_raw / np.linalg.norm(vec_alpha_raw)
    vec_alpha_bytes = vec_alpha.tobytes()

    vec_beta_raw = np.random.randn(512).astype(np.float32)
    vec_beta = vec_beta_raw / np.linalg.norm(vec_beta_raw)
    vec_beta_bytes = vec_beta.tobytes()

    # Store embeddings in DB
    emb_alpha = Embedding(attendee_id=student_alpha.id, embedding=vec_alpha_bytes)
    emb_beta = Embedding(attendee_id=student_beta.id, embedding=vec_beta_bytes)
    test_session.add_all([emb_alpha, emb_beta])
    await test_session.commit()

    # 5. Load FAISS indices for both institutions
    loaded_a = await ensure_institution_index_loaded(test_session, inst_a.id, force=True)
    loaded_b = await ensure_institution_index_loaded(test_session, inst_b.id, force=True)
    assert loaded_a is True
    assert loaded_b is True

    # 6. Test Query in Institution A with Student Alpha's face:
    score_a, matched_id_a = search_institution(inst_a.id, vec_alpha_bytes, threshold=0.6)
    assert matched_id_a == student_alpha.id
    assert score_a is not None and score_a > 0.99

    # 7. CRITICAL: Test Query in Institution B with Student Alpha's face (MUST RETURN ZERO MATCH):
    score_cross, matched_id_cross = search_institution(inst_b.id, vec_alpha_bytes, threshold=0.6)
    assert matched_id_cross is None, "Cross-institution matching occurred! Biometric isolation violated!"

    # 8. Test Query in Institution B with Student Beta's face:
    score_b, matched_id_b = search_institution(inst_b.id, vec_beta_bytes, threshold=0.6)
    assert matched_id_b == student_beta.id
    assert score_b is not None and score_b > 0.99

    # 9. Verify Telemetry reporting
    telemetry = get_active_indices_telemetry()
    assert len(telemetry) == 2
    assert any(t["institution_id"] == str(inst_a.id) and t["total_vectors"] == 1 for t in telemetry)

    # 10. Verify Eviction Policy
    evicted_count = evict_idle_indices(max_idle_seconds=-1) # Evict all immediately
    assert evicted_count == 2
    telemetry_post_evict = get_active_indices_telemetry()
    assert len(telemetry_post_evict) == 0
