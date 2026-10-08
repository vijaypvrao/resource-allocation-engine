# Resource Allocation Engine

Field Service Technician Allocation using **FastAPI + React + Leaflet/OpenStreetMap**.

## New application features

- View current resources and requests with their details.
- Add resources from the UI.
- Add requests from the UI.
- Select exactly which resources and requests participate in an allocation run.
- Run Greedy and Hungarian on only the selected subset.
- Existing map, decision explanations, metrics and algorithm comparison remain available.


## Steps to Run the Application
## Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate       # Windows
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Open `http://localhost:8000/docs` for the API.

The first backend start creates `backend/data/store.json` from the sample scenario. All additions made through the UI are stored there.

## Frontend

In another terminal:

```bash
cd frontend
npm install
npm run dev
```

Open the Vite URL, normally `http://localhost:5173`.

## Allocation flow

1. View the current master data.
2. Add resources/requests if required.
3. Select the resources and requests to participate.
4. Adjust distance/priority weights.
5. Click **Run assignment**.
6. Compare Greedy and Hungarian results and inspect the selected result on the map.

## Persistence design

This intentionally uses a JSON file rather than a database because the assessment requires local, dependency-light storage. In production, the same storage interface could be replaced by PostgreSQL or another transactional store without changing the allocator.

## Tests

From `backend`:

```bash
pytest -q
```
