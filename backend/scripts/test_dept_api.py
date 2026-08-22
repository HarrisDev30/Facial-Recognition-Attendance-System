import asyncio
import httpx

async def test_depts():
    async with httpx.AsyncClient(base_url="http://localhost:8000") as ac:
        res = await ac.get("/api/departments?institution_slug=cjc")
        print("Status:", res.status_code)
        print("Body:", res.text)

if __name__ == "__main__":
    asyncio.run(test_depts())
