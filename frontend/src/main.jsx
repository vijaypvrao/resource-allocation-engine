import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './styles.css';

const API = 'http://localhost:8000/api';

const emptyResource = {
  id: '',
  name: '',
  lat: '',
  lng: '',
  capabilities: '',
  available_from: '2026-10-06T09:00',
  available_until: '2026-10-06T18:00'
};

const emptyRequest = {
  id: '',
  title: '',
  lat: '',
  lng: '',
  requirements: '',
  start: '2026-10-06T10:00',
  end: '2026-10-06T11:00',
  priority: 3
};

/* ============================================================
   MAP
   ============================================================ */

function MapView({ resources, requests, result }) {
  useEffect(() => {
    const map = L.map('map').setView([12.9716, 77.5946], 12);

    L.tileLayer(
      'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      {
        attribution: '© OpenStreetMap contributors'
      }
    ).addTo(map);

    const resourceById = Object.fromEntries(
      resources.map(resource => [resource.id, resource])
    );

    resources.forEach(resource => {
      L.circleMarker(
        [
          resource.location.lat,
          resource.location.lng
        ],
        {
          radius: 8
        }
      )
        .addTo(map)
        .bindPopup(`
          <b>Resource</b><br/>
          ${resource.name}<br/>
          ID: ${resource.id}<br/>
          Skills: ${[...resource.capabilities].join(', ')}
        `);
    });

    requests.forEach(request => {
      L.circleMarker(
        [
          request.location.lat,
          request.location.lng
        ],
        {
          radius: 7,
          fillOpacity: 0.8
        }
      )
        .addTo(map)
        .bindPopup(`
          <b>Request</b><br/>
          ${request.title}<br/>
          ID: ${request.id}<br/>
          Requirements: ${[...request.requirements].join(', ')}<br/>
          Priority: ${request.priority}
        `);
    });

    if (result) {
      result.assignments?.forEach(assignment => {
        const resource = resourceById[assignment.resource_id];

        const request = requests.find(
          item => item.id === assignment.request_id
        );

        if (!resource || !request) {
          return;
        }

        L.polyline(
          [
            [
              resource.location.lat,
              resource.location.lng
            ],
            [
              request.location.lat,
              request.location.lng
            ]
          ],
          {
            weight: 3
          }
        ).addTo(map);
      });
    }

    setTimeout(() => {
      map.invalidateSize();
    }, 100);

    return () => {
      map.remove();
    };
  }, [resources, requests, result]);

  return <div id="map" />;
}

/* ============================================================
   RESULT CARD
   ============================================================ */

function AlgorithmResult({ result }) {
  const isHungarian = result.algorithm === 'hungarian';

  return (
    <section className="algorithmCard">
      <div className="algorithmCardHeader">
        <div>
          <span className="algorithmBadge">
            {isHungarian
              ? 'GLOBAL OPTIMIZATION'
              : 'HEURISTIC'}
          </span>

          <h2>
            {isHungarian ? 'Hungarian' : 'Greedy'}
          </h2>

          <p className="algorithmDescription">
            {isHungarian
              ? 'Finds the globally optimal assignment.'
              : 'Builds an assignment incrementally using the best available match.'}
          </p>
        </div>
      </div>

      <div className="metrics">
        <div className="metric">
          <span>Assigned</span>
          <strong>
            {result.assignments?.length || 0}
          </strong>
        </div>

        <div className="metric">
          <span>Avg Distance</span>
          <strong>
            {result.metrics?.avg_distance_km != null
              ? `${result.metrics.avg_distance_km.toFixed(2)} km`
              : '—'}
          </strong>
        </div>

        <div className="metric">
          <span>Coverage</span>
          <strong>
            {result.metrics?.coverage_pct != null
              ? `${result.metrics.coverage_pct.toFixed(1)}%`
              : '—'}
          </strong>
        </div>

        <div className="metric">
          <span>Total Score</span>
          <strong>
            {result.metrics?.total_score != null
              ? result.metrics.total_score.toFixed(2)
              : '—'}
          </strong>
        </div>
      </div>

      <div className="algorithmAssignments">
        <div className="algorithmSectionTitle">
          Assignments
          <span>
            {result.assignments?.length || 0}
          </span>
        </div>

        {result.assignments?.map(assignment => (
          <div
            className="algorithmAssignment"
            key={`${assignment.request_id}-${assignment.resource_id}`}
          >
            <span>{assignment.request_id}</span>

            <span className="assignmentArrow">
              →
            </span>

            <strong>
              {assignment.resource_id}
            </strong>

            <small>
              {assignment.distance_km != null
                ? `${assignment.distance_km.toFixed(2)} km`
                : '—'}
              {' · '}
              {assignment.score != null
                ? assignment.score.toFixed(3)
                : '—'}
            </small>
          </div>
        ))}
      </div>

      {result.unassigned_request_ids?.length > 0 && (
        <div className="unassignedSection">
          <div className="algorithmSectionTitle">
            Unassigned
            <span>
              {result.unassigned_request_ids.length}
            </span>
          </div>

          <div className="unassignedItems">
            {result.unassigned_request_ids.map(
              requestId => (
                <span key={requestId}>
                  {requestId}
                </span>
              )
            )}
          </div>
        </div>
      )}
    </section>
  );
}

/* ============================================================
   ALGORITHM WINNER
   ============================================================ */

function WinnerCard({
  greedy,
  hungarian,
  winner
}) {
  const greedyMetrics =
    greedy.metrics || {};

  const hungarianMetrics =
    hungarian.metrics || {};

  const optimizedLabel =
	winner?.optimized_algorithm === 'global_optimization'
		? 'Global Optimization'
		: 'Hungarian';

  const winnerName =
	winner?.winner === 'global_optimization'
		? 'Global Optimization'
		: winner?.winner === 'hungarian'
			? 'Hungarian'
			: winner?.winner === 'greedy'
				? 'Greedy'
				: 'Tie';

  const greedyScore =
    greedyMetrics.total_score ?? 0;

  const hungarianScore =
    hungarianMetrics.total_score ?? 0;

  const greedyCoverage =
    greedyMetrics.coverage_pct ?? 0;

  const hungarianCoverage =
    hungarianMetrics.coverage_pct ?? 0;

  const greedyDistance =
    greedyMetrics.total_distance_km ?? 0;

  const hungarianDistance =
    hungarianMetrics.total_distance_km ?? 0;

  const scoreDifference =
    Math.abs(
      greedyScore - hungarianScore
    ).toFixed(2);

  const coverageWinner =
    greedyCoverage > hungarianCoverage
      ? 'Greedy'
      : hungarianCoverage > greedyCoverage
        ? 'Hungarian'
        : 'Tie';

  const distanceWinner =
    greedyDistance < hungarianDistance
      ? 'Greedy'
      : hungarianDistance < greedyDistance
        ? 'Hungarian'
        : 'Tie';

  return (
    <section className="winnerCard">

      <div className="winnerHeader">

        <span className="winnerIcon">
          🏆
        </span>

        <div>
          <span className="winnerLabel">
            BEST ALLOCATION SCORE
          </span>

          <h2>
            {winnerName}
          </h2>
        </div>

      </div>

      <div className="winnerScore">

        <div>
          <span>Greedy</span>

          <strong>
            {greedyScore.toFixed(2)}
          </strong>

          <small>
            Total Score
          </small>
        </div>

        <div className="winnerVs">
          SCORE
        </div>

        <div>
          <span>Hungarian</span>

          <strong>
            {hungarianScore.toFixed(2)}
          </strong>

          <small>
            Total Score
          </small>
        </div>

      </div>

      <div className="winnerReasons">

        <h3>
          Comparison
        </h3>

        <div className="winnerReason">
          <span>Total Score</span>

          <strong>
            {winnerName}
            {winnerName !== 'Tie' &&
              ` by ${scoreDifference}`}
          </strong>
        </div>

        <div className="winnerReason">
          <span>Coverage</span>

          <strong>
            {coverageWinner}
          </strong>
        </div>

        <div className="winnerReason">
          <span>Total Distance</span>

          <strong>
            {distanceWinner}
          </strong>
        </div>

      </div>

      <div className="winnerSummary">

        {winner?.reason ||
          'Winner determined by total allocation score.'}

      </div>

    </section>
  );
}

/* ============================================================
   RESOURCE FORM
   ============================================================ */

function ResourceForm({ onSaved }) {
  const [form, setForm] = useState(emptyResource);
  const [busy, setBusy] = useState(false);

  const update = (key, value) => {
    setForm(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const submit = async event => {
    event.preventDefault();
    setBusy(true);

    try {
      const body = {
        ...form,
        lat: Number(form.lat),
        lng: Number(form.lng),
        capabilities: form.capabilities
          .split(',')
          .map(item => item.trim())
          .filter(Boolean)
      };

      const response = await fetch(
        `${API}/resources`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(body)
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(
          error.detail ||
          'Could not add resource'
        );
      }

      setForm({ ...emptyResource });
      onSaved();
    } catch (error) {
      console.error(
        'Resource save failed:',
        error
      );

      alert(error.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      onSubmit={submit}
      className="form"
    >
      <input
        required
        placeholder="Resource ID"
        value={form.id}
        onChange={event =>
          update(
            'id',
            event.target.value
          )
        }
      />

      <input
        required
        placeholder="Name"
        value={form.name}
        onChange={event =>
          update(
            'name',
            event.target.value
          )
        }
      />

      <div className="two">
        <input
          required
          type="number"
          step="any"
          placeholder="Latitude"
          value={form.lat}
          onChange={event =>
            update(
              'lat',
              event.target.value
            )
          }
        />

        <input
          required
          type="number"
          step="any"
          placeholder="Longitude"
          value={form.lng}
          onChange={event =>
            update(
              'lng',
              event.target.value
            )
          }
        />
      </div>

      <input
        placeholder="Capabilities, e.g. electrical,hvac"
        value={form.capabilities}
        onChange={event =>
          update(
            'capabilities',
            event.target.value
          )
        }
      />

      <div className="two">
        <label>
          Available from

          <input
            required
            type="datetime-local"
            value={form.available_from}
            onChange={event =>
              update(
                'available_from',
                event.target.value
              )
            }
          />
        </label>

        <label>
          Available until

          <input
            required
            type="datetime-local"
            value={form.available_until}
            onChange={event =>
              update(
                'available_until',
                event.target.value
              )
            }
          />
        </label>
      </div>

      <button
        type="submit"
        disabled={busy}
      >
        {busy
          ? 'Saving…'
          : 'Add resource'}
      </button>
    </form>
  );
}

/* ============================================================
   REQUEST FORM
   ============================================================ */

function RequestForm({ onSaved }) {
  const [form, setForm] = useState(emptyRequest);
  const [busy, setBusy] = useState(false);

  const update = (key, value) => {
    setForm(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const submit = async event => {
    event.preventDefault();
    setBusy(true);

    try {
      const body = {
        ...form,
        lat: Number(form.lat),
        lng: Number(form.lng),
        priority: Number(form.priority),
        requirements: form.requirements
          .split(',')
          .map(item => item.trim())
          .filter(Boolean)
      };

      const response = await fetch(
        `${API}/requests`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(body)
        }
      );

      if (!response.ok) {
        const error = await response.json();

        throw new Error(
          error.detail ||
          'Could not add request'
        );
      }

      setForm({ ...emptyRequest });
      onSaved();
    } catch (error) {
      console.error(
        'Request save failed:',
        error
      );

      alert(error.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      onSubmit={submit}
      className="form"
    >
      <input
        required
        placeholder="Request ID"
        value={form.id}
        onChange={event =>
          update(
            'id',
            event.target.value
          )
        }
      />

      <input
        required
        placeholder="Title"
        value={form.title}
        onChange={event =>
          update(
            'title',
            event.target.value
          )
        }
      />

      <div className="two">
        <input
          required
          type="number"
          step="any"
          placeholder="Latitude"
          value={form.lat}
          onChange={event =>
            update(
              'lat',
              event.target.value
            )
          }
        />

        <input
          required
          type="number"
          step="any"
          placeholder="Longitude"
          value={form.lng}
          onChange={event =>
            update(
              'lng',
              event.target.value
            )
          }
        />
      </div>

      <input
        placeholder="Requirements, e.g. electrical,hvac"
        value={form.requirements}
        onChange={event =>
          update(
            'requirements',
            event.target.value
          )
        }
      />

      <div className="two">
        <label>
          Start

          <input
            required
            type="datetime-local"
            value={form.start}
            onChange={event =>
              update(
                'start',
                event.target.value
              )
            }
          />
        </label>

        <label>
          End

          <input
            required
            type="datetime-local"
            value={form.end}
            onChange={event =>
              update(
                'end',
                event.target.value
              )
            }
          />
        </label>
      </div>

      <label>
        Priority (1-5)

        <input
          required
          type="number"
          min="1"
          max="5"
          value={form.priority}
          onChange={event =>
            update(
              'priority',
              event.target.value
            )
          }
        />
      </label>

      <button
        type="submit"
        disabled={busy}
      >
        {busy
          ? 'Saving…'
          : 'Add request'}
      </button>
    </form>
  );
}

/* ============================================================
   RESOURCES TABLE
   ============================================================ */

function ResourcesTable({ resources, onSaved }) {
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState(emptyResource);
  const [busy, setBusy] = useState(false);

  const update = (field, value) => {
    setForm(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const save = async () => {
    setBusy(true);

    try {
      const response = await fetch(
        `${API}/resources`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            id: form.id,
            name: form.name,
            lat: Number(form.lat),
            lng: Number(form.lng),
            capabilities: form.capabilities
              .split(',')
              .map(item => item.trim())
              .filter(Boolean),
            available_from:
              form.available_from,
            available_until:
              form.available_until
          })
        }
      );

      const json = await response.json();

      if (!response.ok) {
        throw new Error(
          json.detail ||
          'Failed to add resource'
        );
      }

      setForm({ ...emptyResource });
      setAdding(false);
      onSaved();
    } catch (error) {
      console.error(
        'Resource save failed:',
        error
      );

      alert(error.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="tableWrap">
      <table className="dataTable">
        <thead>
          <tr>
            <th>ID</th>
            <th>Name</th>
            <th>Location</th>
            <th>Capabilities</th>
            <th>Availability</th>
          </tr>
        </thead>

        <tbody>
          {resources.map(resource => (
            <tr key={resource.id}>
              <td>{resource.id}</td>

              <td>{resource.name}</td>

              <td>
                {resource.location?.lat},{' '}
                {resource.location?.lng}
              </td>

              <td>
                {resource.capabilities?.join(', ')}
              </td>

              <td>
                {resource.available_from}
                <br />
                {resource.available_until}
              </td>
            </tr>
          ))}

          {adding && (
            <tr className="newRow">
              <td>
                <input
                  required
                  value={form.id}
                  onChange={event =>
                    update(
                      'id',
                      event.target.value
                    )
                  }
                  placeholder="R-006"
                />
              </td>

              <td>
                <input
                  required
                  value={form.name}
                  onChange={event =>
                    update(
                      'name',
                      event.target.value
                    )
                  }
                  placeholder="Technician name"
                />
              </td>

              <td>
                <input
                  required
                  value={form.lat}
                  onChange={event =>
                    update(
                      'lat',
                      event.target.value
                    )
                  }
                  placeholder="Lat"
                />

                <input
                  required
                  value={form.lng}
                  onChange={event =>
                    update(
                      'lng',
                      event.target.value
                    )
                  }
                  placeholder="Lng"
                />
              </td>

              <td>
                <input
                  value={form.capabilities}
                  onChange={event =>
                    update(
                      'capabilities',
                      event.target.value
                    )
                  }
                  placeholder="java, network, hardware"
                />
              </td>

              <td>
                <input
                  required
                  type="datetime-local"
                  value={
                    form.available_from
                  }
                  onChange={event =>
                    update(
                      'available_from',
                      event.target.value
                    )
                  }
                />

                <input
                  required
                  type="datetime-local"
                  value={
                    form.available_until
                  }
                  onChange={event =>
                    update(
                      'available_until',
                      event.target.value
                    )
                  }
                />

                <div className="rowActions">
                  <button
                    type="button"
                    className="smallButton primary"
                    onClick={save}
                    disabled={busy}
                  >
                    {busy
                      ? 'Saving…'
                      : 'Save'}
                  </button>

                  <button
                    type="button"
                    className="smallButton"
                    onClick={() => {
                      setAdding(false);
                      setForm({
                        ...emptyResource
                      });
                    }}
                    disabled={busy}
                  >
                    Cancel
                  </button>
                </div>
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {!adding && (
        <button
          type="button"
          className="addRowButton"
          onClick={() => setAdding(true)}
        >
          + Add Resource
        </button>
      )}
    </div>
  );
}

/* ============================================================
   REQUESTS TABLE
   ============================================================ */

function RequestsTable({ requests, onSaved }) {
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState(emptyRequest);
  const [busy, setBusy] = useState(false);

  const update = (field, value) => {
    setForm(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const save = async () => {
    setBusy(true);

    try {
      const response = await fetch(
        `${API}/requests`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            id: form.id,
            title: form.title,
            lat: Number(form.lat),
            lng: Number(form.lng),
            requirements:
              form.requirements
                .split(',')
                .map(item => item.trim())
                .filter(Boolean),
            start: form.start,
            end: form.end,
            priority: Number(form.priority)
          })
        }
      );

      const json = await response.json();

      if (!response.ok) {
        throw new Error(
          json.detail ||
          'Failed to add request'
        );
      }

      setForm({ ...emptyRequest });
      setAdding(false);
      onSaved();
    } catch (error) {
      console.error(
        'Request save failed:',
        error
      );

      alert(error.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="tableWrap">
      <table className="dataTable">
        <thead>
          <tr>
            <th>ID</th>
            <th>Title</th>
            <th>Location</th>
            <th>Requirements</th>
            <th>Window</th>
            <th>Priority</th>
          </tr>
        </thead>

        <tbody>
          {requests.map(request => (
            <tr key={request.id}>
              <td>{request.id}</td>

              <td>{request.title}</td>

              <td>
                {request.location?.lat},{' '}
                {request.location?.lng}
              </td>

              <td>
                {request.requirements?.join(', ')}
              </td>

              <td>
                {request.start}
                <br />
                {request.end}
              </td>

              <td>{request.priority}</td>
            </tr>
          ))}

          {adding && (
            <tr className="newRow">
              <td>
                <input
                  required
                  value={form.id}
                  onChange={event =>
                    update(
                      'id',
                      event.target.value
                    )
                  }
                  placeholder="REQ-006"
                />
              </td>

              <td>
                <input
                  required
                  value={form.title}
                  onChange={event =>
                    update(
                      'title',
                      event.target.value
                    )
                  }
                  placeholder="Request title"
                />
              </td>

              <td>
                <input
                  required
                  value={form.lat}
                  onChange={event =>
                    update(
                      'lat',
                      event.target.value
                    )
                  }
                  placeholder="Lat"
                />

                <input
                  required
                  value={form.lng}
                  onChange={event =>
                    update(
                      'lng',
                      event.target.value
                    )
                  }
                  placeholder="Lng"
                />
              </td>

              <td>
                <input
                  value={form.requirements}
                  onChange={event =>
                    update(
                      'requirements',
                      event.target.value
                    )
                  }
                  placeholder="java, network"
                />
              </td>

              <td>
                <input
                  required
                  type="datetime-local"
                  value={form.start}
                  onChange={event =>
                    update(
                      'start',
                      event.target.value
                    )
                  }
                />

                <input
                  required
                  type="datetime-local"
                  value={form.end}
                  onChange={event =>
                    update(
                      'end',
                      event.target.value
                    )
                  }
                />
              </td>

              <td>
                <input
                  required
                  type="number"
                  min="1"
                  max="5"
                  value={form.priority}
                  onChange={event =>
                    update(
                      'priority',
                      event.target.value
                    )
                  }
                />

                <div className="rowActions">
                  <button
                    type="button"
                    className="smallButton primary"
                    onClick={save}
                    disabled={busy}
                  >
                    {busy
                      ? 'Saving…'
                      : 'Save'}
                  </button>

                  <button
                    type="button"
                    className="smallButton"
                    onClick={() => {
                      setAdding(false);
                      setForm({
                        ...emptyRequest
                      });
                    }}
                    disabled={busy}
                  >
                    Cancel
                  </button>
                </div>
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {!adding && (
        <button
          type="button"
          className="addRowButton"
          onClick={() => setAdding(true)}
        >
          + Add Request
        </button>
      )}
    </div>
  );
}

/* ============================================================
   MAIN APPLICATION
   ============================================================ */

function App() {
  const [data, setData] = useState(null);

  const [results, setResults] = useState([]);

  const [activeTab, setActiveTab] = useState('overview');

  const [selectedResult, setSelectedResult] = useState(null);
 
  const [allocationWinner, setAllocationWinner] = useState(null); 
	

  const [weights, setWeights] = useState({
    distance_weight: 1,
    priority_weight: 2
  });

  const [
    assignmentMode,
    setAssignmentMode
  ] = useState('one_to_one');

  const [
    selectedResources,
    setSelectedResources
  ] = useState(new Set());

  const [
    selectedRequests,
    setSelectedRequests
  ] = useState(new Set());

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState('');

  /* ==========================================================
     LOAD SCENARIO
     ========================================================== */

  const load = async () => {
    try {
      setError('');

      const response = await fetch(
        `${API}/scenario`
      );

      const json = await response.json();

      if (!response.ok) {
        throw new Error(
          json.detail ||
          'Failed to load scenario'
        );
      }

      setData(json);

      setSelectedResources(
        new Set(
          json.resources.map(
            resource => resource.id
          )
        )
      );

      setSelectedRequests(
        new Set(
          json.requests.map(
            request => request.id
          )
        )
      );
    } catch (loadError) {
      console.error(
        'Scenario load failed:',
        loadError
      );

      setError(
        'Backend unavailable. Start FastAPI on port 8000.'
      );
    }
  };

  useEffect(() => {
    load();
  }, []);

  /* ==========================================================
     SELECTION
     ========================================================== */

  const toggle = (
    setter,
    id
  ) => {
    setter(previous => {
      const next = new Set(previous);

      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }

      return next;
    });
  };

  /* ==========================================================
     REFRESH
     ========================================================== */

  const refresh = () => {
    setResults([]);
    setSelectedResult(null);
	setAllocationWinner(null);
    load();
  };

  /* ==========================================================
     RUN ALLOCATION
     ========================================================== */

  const run = async () => {
    if (
      !selectedResources.size ||
      !selectedRequests.size
    ) {
      alert(
        'Select at least one resource and one request.'
      );

      return;
    }

    setLoading(true);

    try {
      const response = await fetch(
        `${API}/allocate`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            resource_ids: [
              ...selectedResources
            ],
            request_ids: [
              ...selectedRequests
            ],
            ...weights,
            assignment_mode:
              assignmentMode
          })
        }
      );

      const json = await response.json();

      if (!response.ok) {
        throw new Error(
          json.detail ||
          'Allocation failed'
        );
      }

      setData({
        resources: json.resources,
        requests: json.requests
      });

      setResults(json.results);
	  setAllocationWinner(json.winner);
	  
      const preferredResult =
	    json.results.find(
          result =>
            result.algorithm === 'hungarian' ||
            result.algorithm === 'global_optimization'
        ) || json.results[0];

      setSelectedResult(
        preferredResult
      );

      setActiveTab('allocation');
    } catch (allocationError) {
      console.error(
        'Allocation failed:',
        allocationError
      );

      alert(
        allocationError.message ||
        'Allocation failed'
      );
    } finally {
      setLoading(false);
    }
  };

  /* ==========================================================
     LOADING / ERROR STATES
     ========================================================== */

  if (error) {
    return (
      <main className="appShell">
        <div className="errorScreen">
          <h1>
            Resource Allocation Engine
          </h1>

          <p>{error}</p>
        </div>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="appShell">
        <div className="loadingScreen">
          Loading application…
        </div>
      </main>
    );
  }

  /* ==========================================================
     DERIVED DATA
     ========================================================== */

  const greedy = results.find(
    result =>
      result.algorithm === 'greedy'
  );

  const optimized = results.find(
	result =>
	  result.algorithm === 'hungarian' ||
	  result.algorithm === 'global_optimization'
  );

  const hungarian = results.find(
    result => result.algorithm === 'hungarian'
  );

  /* ==========================================================
     APPLICATION
     ========================================================== */

  return (
    <main className="appShell">
      {/* ======================================================
          HEADER
          ====================================================== */}

      <header className="appHeader">
        <div>
          <div className="eyebrow">
            FIELD SERVICE OPTIMIZATION
          </div>

          <h1>
            Resource Allocation Engine
          </h1>

          <p>
            Allocate technicians to service
            requests using constraint-aware
            optimization.
          </p>
        </div>
      </header>

      {/* ======================================================
          TABS
          ====================================================== */}

      <nav className="tabs">
        <button
          type="button"
          className={
            activeTab === 'overview'
              ? 'active'
              : ''
          }
          onClick={() =>
            setActiveTab('overview')
          }
        >
          Overview
        </button>

        <button
          type="button"
          className={
            activeTab === 'data'
              ? 'active'
              : ''
          }
          onClick={() =>
            setActiveTab('data')
          }
        >
          Data
        </button>

        <button
          type="button"
          className={
            activeTab === 'allocation'
              ? 'active'
              : ''
          }
          onClick={() =>
            setActiveTab('allocation')
          }
        >
          Allocation
        </button>

        <button
          type="button"
          className={
            activeTab === 'results'
              ? 'active'
              : ''
          }
          onClick={() =>
            setActiveTab('results')
          }
        >
          Results

          {results.length > 0 && (
            <span className="resultDot" />
          )}
        </button>
      </nav>

      {/* ======================================================
          OVERVIEW
          ====================================================== */}

      {activeTab === 'overview' && (
        <section className="page">
          <div className="overviewSummary panel">
            <div className="overviewSectionHeader">
              <div>
                <h2>
                  Scenario Summary
                </h2>

                <p>
                  Current dataset and
                  allocation scope
                </p>
              </div>
            </div>

            <div className="overviewTableWrap">
              <table className="overviewTable">
                <thead>
                  <tr>
                    <th>Entity</th>
                    <th>Total</th>
                    <th>Selected</th>
                    <th>Scope</th>
                  </tr>
                </thead>

                <tbody>
                  <tr>
                    <td>
                      <strong>
                        Resources
                      </strong>
                    </td>

                    <td>
                      {data.resources.length}
                    </td>

                    <td>
                      {selectedResources.size}
                    </td>

                    <td>
                      {data.resources.length
                        ? `${Math.round(
                            (selectedResources.size /
                              data.resources.length) *
                              100
                          )}%`
                        : '—'}
                    </td>
                  </tr>

                  <tr>
                    <td>
                      <strong>
                        Requests
                      </strong>
                    </td>

                    <td>
                      {data.requests.length}
                    </td>

                    <td>
                      {selectedRequests.size}
                    </td>

                    <td>
                      {data.requests.length
                        ? `${Math.round(
                            (selectedRequests.size /
                              data.requests.length) *
                              100
                          )}%`
                        : '—'}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="overviewLowerGrid">
            <section className="panel">
              <div className="panelTitle">
                <div>
                  <h2>
                    How to use the application
                  </h2>

                  <p>
                    Follow the workflow from
                    data preparation through
                    algorithm comparison.
                  </p>
                </div>
              </div>

              <div className="workflow">
                <div className="workflowStep">
                  <span>1</span>

                  <div>
                    <strong>
                      Manage data
                    </strong>

                    <p>
                      View existing technicians
                      and requests or add new
                      ones.
                    </p>
                  </div>
                </div>

                <div className="workflowStep">
                  <span>2</span>

                  <div>
                    <strong>
                      Select allocation scope
                    </strong>

                    <p>
                      Choose exactly which
                      resources and requests
                      should participate.
                    </p>
                  </div>
                </div>

                <div className="workflowStep">
                  <span>3</span>

                  <div>
                    <strong>
                      Run assignment
                    </strong>

                    <p>
                      Execute Greedy and
                      Hungarian against the
                      selected data.
                    </p>
                  </div>
                </div>

                <div className="workflowStep">
                  <span>4</span>

                  <div>
                    <strong>
                      Compare results
                    </strong>

                    <p>
                      Compare coverage,
                      distance, score and
                      individual assignments.
                    </p>
                  </div>
                </div>
              </div>
            </section>

            <section className="panel">
              <div className="panelTitle">
                <div>
                  <h2>
                    Last allocation
                  </h2>

                  <p>
                    {results.length
                      ? 'Latest algorithm comparison'
                      : 'No allocation has been run yet.'}
                  </p>
                </div>
              </div>

              {!results.length ? (
                <div className="emptyState">
                  <div className="emptyIcon">
                    ⚙
                  </div>

                  <strong>
                    Ready to allocate
                  </strong>

                  <span>
                    Go to Allocation and click
                    Run Allocation.
                  </span>
                </div>
              ) : (
                <div className="miniComparison">
                  {greedy && (
                    <div>
                      <span>
                        Greedy coverage
                      </span>

                      <strong>
                        {greedy.metrics?.coverage_pct?.toFixed(
                          1
                        )}
                        %
                      </strong>
                    </div>
                  )}

                  {hungarian && (
                    <div>
                      <span>
                        Hungarian coverage
                      </span>

                      <strong>
                        {hungarian.metrics?.coverage_pct?.toFixed(
                          1
                        )}
                        %
                      </strong>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() =>
                      setActiveTab(
                        'results'
                      )
                    }
                  >
                    View detailed comparison →
                  </button>
                </div>
              )}
            </section>
          </div>
        </section>
      )}

      {/* ======================================================
          DATA
          ====================================================== */}

      {activeTab === 'data' && (
        <section className="page">
          <div className="pageHeading">
            <div>
              <h2>
                Master Data
              </h2>

              <p>
                Manage technicians and service
                requests directly in the tables.
              </p>
            </div>
          </div>

          <div className="dataSplit">
            <section className="panel">
              <div className="sectionHeader">
                <div>
                  <h2>
                    Resources
                  </h2>

                  <span className="countBadge">
                    {data.resources.length}
                  </span>
                </div>
              </div>

              <ResourcesTable
                resources={data.resources}
                onSaved={refresh}
              />
            </section>

            <section className="panel">
              <div className="sectionHeader">
                <div>
                  <h2>
                    Requests
                  </h2>

                  <span className="countBadge">
                    {data.requests.length}
                  </span>
                </div>
              </div>

              <RequestsTable
                requests={data.requests}
                onSaved={refresh}
              />
            </section>
          </div>
        </section>
      )}

      {/* ======================================================
          ALLOCATION
          ====================================================== */}

      {activeTab === 'allocation' && (
        <section className="page">
          <div className="pageHeading">
            <div>
              <h2>
                Allocation
              </h2>

              <p>
                Select resources and requests,
                configure weights, and run
                allocation.
              </p>
            </div>
          </div>

          {selectedResult && (
            <section className="allocationStatus">
              <div className="allocationStatusHeader">
                <div>
                  <span className="successIndicator">
                    ✓
                  </span>

                  <div>
                    <strong>
                      Allocation completed
                    </strong>

                    <span>
                      {selectedResult.algorithm ===
                      'hungarian'
                        ? 'Hungarian optimization'
                        : 'Greedy optimization'}

                      {' · '}

                      {selectedResult.metrics
                        ?.assignment_mode ===
                      'one_to_many'
                        ? 'One-to-Many'
                        : 'One-to-One'}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  className="smallButton"
                  onClick={() =>
                    setActiveTab(
                      'results'
                    )
                  }
                >
                  Compare Algorithms →
                </button>
              </div>

              <div className="allocationStatusMetrics">
                <div>
                  <span>
                    Assigned
                  </span>

                  <strong>
                    {selectedResult.assignments
                      ?.length || 0}
                  </strong>
                </div>

                <div>
                  <span>
                    Unassigned
                  </span>

                  <strong>
                    {selectedResult
                      .unassigned_request_ids
                      ?.length || 0}
                  </strong>
                </div>

                <div>
                  <span>
                    Coverage
                  </span>

                  <strong>
                    {selectedResult.metrics
                      ?.coverage_pct != null
                      ? `${selectedResult.metrics.coverage_pct.toFixed(
                          1
                        )}%`
                      : '—'}
                  </strong>
                </div>

                <div>
                  <span>
                    Avg Distance
                  </span>

                  <strong>
                    {selectedResult.metrics
                      ?.avg_distance_km != null
                      ? `${selectedResult.metrics.avg_distance_km.toFixed(
                          2
                        )} km`
                      : '—'}
                  </strong>
                </div>
              </div>
            </section>
          )}

          <div className="allocationWorkspace">
            {/* =================================================
                COLUMN 1 — RESOURCES
                ================================================= */}

            <section className="panel allocationColumn">
              <div className="sectionHeader">
                <div>
                  <h2>
                    Resources
                  </h2>

                  <span className="countBadge">
                    {selectedResources.size}/
                    {data.resources.length}
                  </span>
                </div>
              </div>

              <div className="sectionActions">
                <button
                  type="button"
                  className="smallButton"
                  onClick={() =>
                    setSelectedResources(
                      new Set(
                        data.resources.map(
                          resource =>
                            resource.id
                        )
                      )
                    )
                  }
                >
                  All
                </button>

                <button
                  type="button"
                  className="smallButton"
                  onClick={() =>
                    setSelectedResources(
                      new Set()
                    )
                  }
                >
                  None
                </button>
              </div>

              <div className="compactSelectionList">
                {data.resources.map(
                  resource => (
                    <label
                      className="compactSelectionRow"
                      key={resource.id}
                    >
                      <input
                        type="checkbox"
                        checked={selectedResources.has(
                          resource.id
                        )}
                        onChange={() =>
                          toggle(
                            setSelectedResources,
                            resource.id
                          )
                        }
                      />

                      <span className="selectionId">
                        {resource.id}
                      </span>

                      <span className="selectionName">
                        {resource.name}
                      </span>
                    </label>
                  )
                )}
              </div>
            </section>

            {/* =================================================
                COLUMN 2 — REQUESTS
                ================================================= */}

            <section className="panel allocationColumn">
              <div className="sectionHeader">
                <div>
                  <h2>
                    Requests
                  </h2>

                  <span className="countBadge">
                    {selectedRequests.size}/
                    {data.requests.length}
                  </span>
                </div>
              </div>

              <div className="sectionActions">
                <button
                  type="button"
                  className="smallButton"
                  onClick={() =>
                    setSelectedRequests(
                      new Set(
                        data.requests.map(
                          request =>
                            request.id
                        )
                      )
                    )
                  }
                >
                  All
                </button>

                <button
                  type="button"
                  className="smallButton"
                  onClick={() =>
                    setSelectedRequests(
                      new Set()
                    )
                  }
                >
                  None
                </button>
              </div>

              <div className="compactSelectionList">
                {data.requests.map(
                  request => (
                    <label
                      className="compactSelectionRow"
                      key={request.id}
                    >
                      <input
                        type="checkbox"
                        checked={selectedRequests.has(
                          request.id
                        )}
                        onChange={() =>
                          toggle(
                            setSelectedRequests,
                            request.id
                          )
                        }
                      />

                      <span className="selectionId">
                        {request.id}
                      </span>

                      <span className="selectionName">
                        {request.title}
                      </span>
                    </label>
                  )
                )}
              </div>
            </section>

            {/* =================================================
                COLUMN 3 — WEIGHTS + RUN
                ================================================= */}

            <section className="panel allocationColumn">
              <div className="sectionHeader">
                <div>
                  <h2>
                    Weights
                  </h2>

                  <p>
                    Optimization priorities
                  </p>
                </div>
              </div>

              <div className="weightControls">
                <div className="weightControl">
                  <div className="weightLabel">
                    <span>
                      Distance
                    </span>

                    <strong>
                      {weights.distance_weight}
                    </strong>
                  </div>

                  <input
                    type="range"
                    min="0"
                    max="5"
                    step="0.5"
                    value={
                      weights.distance_weight
                    }
                    onChange={event =>
                      setWeights(
                        previous => ({
                          ...previous,
                          distance_weight:
                            Number(
                              event.target.value
                            )
                        })
                      )
                    }
                  />
                </div>

                <div className="weightControl">
                  <div className="weightLabel">
                    <span>
                      Priority
                    </span>

                    <strong>
                      {weights.priority_weight}
                    </strong>
                  </div>

                  <input
                    type="range"
                    min="0"
                    max="5"
                    step="0.5"
                    value={
                      weights.priority_weight
                    }
                    onChange={event =>
                      setWeights(
                        previous => ({
                          ...previous,
                          priority_weight:
                            Number(
                              event.target.value
                            )
                        })
                      )
                    }
                  />
                </div>
              </div>

              <div className="allocationSummary">
                <div>
                  <span>
                    Resources
                  </span>

                  <strong>
                    {selectedResources.size}
                  </strong>
                </div>

                <div>
                  <span>
                    Requests
                  </span>

                  <strong>
                    {selectedRequests.size}
                  </strong>
                </div>
              </div>

              {/* =================================================
                  ASSIGNMENT MODE
                  ================================================= */}

              <div className="assignmentModeControl">
                <div className="assignmentModeLabel">
                  <strong>
                    Assignment Mode
                  </strong>

                  <span>
                    Choose how resources can
                    be reused
                  </span>
                </div>

                <div className="assignmentModeOptions">
                  <button
                    type="button"
                    className={`assignmentModeOption ${
                      assignmentMode ===
                      'one_to_one'
                        ? 'active'
                        : ''
                    }`}
                    onClick={() =>
                      setAssignmentMode(
                        'one_to_one'
                      )
                    }
                  >
                    <span className="modeTitle">
                      One-to-One
                    </span>
                    <br />
                    <span className="modeDescription">
                      One Resource per Request
                    </span>
                  </button>

                  <button
                    type="button"
                    className={`assignmentModeOption ${
                      assignmentMode ===
                      'one_to_many'
                        ? 'active'
                        : ''
                    }`}
                    onClick={() =>
                      setAssignmentMode(
                        'one_to_many'
                      )
                    }
                  >
                    <span className="modeTitle">
                      One-to-Many
                    </span>
					<br />
                    <span className="modeDescription">
                      One Resource can serve multiple Requests
                    </span>
                  </button>
                </div>
              </div>

              <button
                type="button"
                className="runButton allocationRunButton"
                onClick={run}
                disabled={
                  loading ||
                  selectedResources.size ===
                    0 ||
                  selectedRequests.size ===
                    0
                }
              >
                {loading
                  ? 'Optimizing…'
                  : 'Run Allocation'}
              </button>
            </section>

            {/* =================================================
                COLUMN 4 — MAP
                ================================================= */}

            <section className="panel allocationColumn mapColumn">
              <div className="sectionHeader">
                <div>
                  <h2>
                    Map
                  </h2>

                  <p>
                    Resources, requests and
                    allocation paths
                  </p>
                </div>

                {results.length > 0 && (
                  <div className="sectionActions">
                    {results.map(
                      result => (
                        <button
                          type="button"
                          key={result.algorithm}
                          className={
                            selectedResult?.algorithm ===
                            result.algorithm
                              ? 'smallButton primary'
                              : 'smallButton'
                          }
                          onClick={() =>
                            setSelectedResult(
                              result
                            )
                          }
                        >
                          {result.algorithm ===
                          'hungarian'
                            ? 'Hungarian'
                            : 'Greedy'}
                        </button>
                      )
                    )}
                  </div>
                )}
              </div>

              <div className="allocationMap">
                <MapView
                  resources={data.resources.filter(
                    resource =>
                      selectedResources.has(
                        resource.id
                      )
                  )}
                  requests={data.requests.filter(
                    request =>
                      selectedRequests.has(
                        request.id
                      )
                  )}
                  result={selectedResult}
                />
              </div>
            </section>
          </div>
        </section>
      )}

      {/* ======================================================
          RESULTS
          ====================================================== */}

      {activeTab === 'results' && (
        <section className="page">
          <div className="pageHeading">
            <div>
              <h2>
                Algorithm Comparison
              </h2>

              <p>
                Compare Greedy and Hungarian
                optimization under the selected
                assignment mode.
              </p>
            </div>

            <button
              type="button"
              className="smallButton"
              onClick={() =>
                setActiveTab(
                  'allocation'
                )
              }
            >
              ← Back to Allocation
            </button>
          </div>

          {results.length > 0 && (
            <div className="resultsModeBanner">
              <span>
                Assignment Mode
              </span>

              <strong>
                {results[0]?.metrics
                  ?.assignment_mode ===
                'one_to_many'
                  ? 'One-to-Many'
                  : 'One-to-One'}
              </strong>

              <small>
                {results[0]?.metrics
                  ?.assignment_mode ===
                'one_to_many'
                  ? 'Resources may be reused across multiple requests.'
                  : 'Each resource can be assigned to at most one request.'}
              </small>
            </div>
          )}

          {!results.length ? (
            <section className="panel emptyResults">
              <h2>
                No allocation results yet
              </h2>

              <p>
                Go to Allocation and run the
                assignment to compare the
                algorithms.
              </p>

              <button
                type="button"
                className="runButton"
                onClick={() =>
                  setActiveTab(
                    'allocation'
                  )
                }
              >
                Go to Allocation
              </button>
            </section>
          ) : (
            <>
              <div className="algorithmComparisonGrid">
                {greedy && (
                  <AlgorithmResult
                    result={greedy}
                  />
                )}

                {hungarian && (
                  <AlgorithmResult
                    result={hungarian}
                  />
                )}

                {greedy &&
                  hungarian && (
                    <WinnerCard
						greedy={greedy}
						hungarian={hungarian}
						winner={allocationWinner}
					/>
                  )}
              </div>
            </>
          )}
        </section>
      )}
    </main>
  );
}

/* ============================================================
   APPLICATION START
   ============================================================ */

createRoot(
  document.getElementById('root')
).render(
  <App />
);