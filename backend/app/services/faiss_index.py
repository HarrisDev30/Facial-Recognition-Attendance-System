import hashlib
import math
import threading
import uuid

import faiss
import numpy as np
from app.config import settings

_index: faiss.Index | None = None
_attendee_ids: list[uuid.UUID] = []
_lock = threading.Lock()

EMBEDDING_DIM = 512

_index_hash: str | None = None


def _compute_content_hash(rows: list[tuple]) -> str:
    if not rows:
        return ""
    count = len(rows)
    last_id = str(rows[-1][2])
    return hashlib.sha256(f"{count}:{last_id}".encode()).hexdigest()


def _compute_nprobe(nlist: int, n_total: int) -> int:
    if n_total < 500:
        return nlist
    if n_total < 5000:
        return max(20, nlist // 2)
    return max(1, int(nlist * settings.faiss_nprobe_ratio))


def build_index(
    embeddings: list[tuple[bytes, uuid.UUID, uuid.UUID]],
    force: bool = False,
) -> bool:
    global _index, _attendee_ids, _index_hash

    content_hash = _compute_content_hash(embeddings)
    if not force and content_hash == _index_hash:
        return False

    new_attendee_ids: list[uuid.UUID] = []
    vectors = []
    for emb_bytes, attendee_id, _ in embeddings:
        vec = np.frombuffer(emb_bytes, dtype=np.float32)
        norm = np.linalg.norm(vec)
        if norm == 0:
            continue
        vec = vec / norm
        vectors.append(vec)
        new_attendee_ids.append(attendee_id)

    if not vectors:
        with _lock:
            _index = None
            _attendee_ids = []
            _index_hash = content_hash
        return True

    vec_array = np.array(vectors, dtype=np.float32)
    n_total = len(vectors)

    if n_total < 16:
        new_index = faiss.IndexFlatIP(EMBEDDING_DIM)
        new_index.add(vec_array)
        with _lock:
            _index = new_index
            _attendee_ids = new_attendee_ids
            _index_hash = content_hash
        return True

    nlist = min(int(4 * math.sqrt(n_total)), settings.faiss_max_nlist)
    nlist = max(1, nlist)

    if n_total >= settings.faiss_pq_threshold:
        m = min(settings.faiss_pq_m, EMBEDDING_DIM)
        quantizer = faiss.IndexFlatIP(EMBEDDING_DIM)
        new_index = faiss.IndexIVFPQ(
            quantizer, EMBEDDING_DIM, nlist, m, settings.faiss_pq_bits, faiss.METRIC_INNER_PRODUCT
        )
    else:
        quantizer = faiss.IndexFlatIP(EMBEDDING_DIM)
        new_index = faiss.IndexIVFFlat(quantizer, EMBEDDING_DIM, nlist, faiss.METRIC_INNER_PRODUCT)

    new_index.train(vec_array)
    new_index.add(vec_array)
    new_index.nprobe = _compute_nprobe(nlist, n_total)

    with _lock:
        _index = new_index
        _attendee_ids = new_attendee_ids
        _index_hash = content_hash
    return True


def set_nprobe(nprobe: int) -> None:
    with _lock:
        if _index is not None and hasattr(_index, "nprobe"):
            _index.nprobe = nprobe


def is_ready() -> bool:
    with _lock:
        return _index is not None and _index.ntotal > 0


def search(
    query_embedding: bytes,
    threshold: float = 0.6,
    min_margin: float = 0.0,
) -> tuple[float | None, uuid.UUID | None]:
    with _lock:
        idx_ref = _index
        aids = list(_attendee_ids)

    if idx_ref is None or idx_ref.ntotal == 0:
        return None, None

    q = np.frombuffer(query_embedding, dtype=np.float32).reshape(1, -1)
    q_norm = np.linalg.norm(q)
    if q_norm == 0:
        return None, None
    q = q / q_norm

    k = min(2, idx_ref.ntotal)
    distances, indices = idx_ref.search(q, k)
    top_idx = indices[0][0]
    if top_idx == -1:
        return None, None

    score = float(distances[0][0])
    if score < threshold:
        return score, None

    if k == 2 and indices[0][1] != -1:
        second_score = float(distances[0][1])
        if score - second_score < min_margin:
            return score, None

    return score, aids[top_idx]


def batch_search(
    query_embeddings: list[bytes],
    threshold: float = 0.6,
    min_margin: float = 0.0,
) -> list[tuple[float | None, uuid.UUID | None]]:
    with _lock:
        idx_ref = _index
        aids = list(_attendee_ids)

    if idx_ref is None or idx_ref.ntotal == 0:
        return [(None, None)] * len(query_embeddings)

    queries = []
    for emb_bytes in query_embeddings:
        q = np.frombuffer(emb_bytes, dtype=np.float32).reshape(1, -1)
        q_norm = np.linalg.norm(q)
        if q_norm == 0:
            queries.append(np.zeros((1, EMBEDDING_DIM), dtype=np.float32))
        else:
            queries.append(q / q_norm)

    all_q = np.vstack(queries)
    k = min(2, idx_ref.ntotal)
    distances, indices = idx_ref.search(all_q, k)

    results = []
    for i in range(len(query_embeddings)):
        top_idx = indices[i][0]
        if top_idx == -1:
            results.append((None, None))
            continue
        score = float(distances[i][0])
        if score < threshold:
            results.append((score, None))
            continue

        if k == 2 and indices[i][1] != -1:
            second_score = float(distances[i][1])
            if score - second_score < min_margin:
                results.append((score, None))
                continue

        results.append((score, aids[top_idx]))

    return results


def clear() -> None:
    global _index, _attendee_ids, _index_hash
    with _lock:
        _index = None
        _attendee_ids = []
        _index_hash = None


async def force_rebuild() -> None:
    import asyncio

    from app.database import get_session_ctx
    from app.models.embedding import Embedding
    from sqlalchemy import select

    async with get_session_ctx() as session:
        result = await session.execute(
            select(
                Embedding.embedding,
                Embedding.attendee_id,
                Embedding.id,
            )
        )
        rows = list(result.all())

    loop = asyncio.get_running_loop()
    await loop.run_in_executor(None, build_index, rows, True)
