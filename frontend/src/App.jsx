import React from "react";
import useAllocationController from "./hooks/useAllocationController.js";
import MapView from './components/MapView.jsx';
import { AlgorithmResult, WinnerCard } from './components/ResultCards.jsx';
import { ResourceForm, RequestForm } from './components/Forms.jsx';
import { ResourcesTable, RequestsTable } from './components/Tables.jsx';
export default function App() {
  const { data, results, activeTab, selectedResult, mapMode, llmStatus, allocationWinner, weights, assignmentMode, selectedResources, selectedRequests, loading, error, setActiveTab, setSelectedResult, setMapMode, setWeights, setAssignmentMode, setSelectedResources, setSelectedRequests, refresh, toggle, run } = useAllocationController();

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

  const greedy =
    results.find(
      result =>
        result.algorithm ===
        'greedy'
    );

  const optimized =
    results.find(
      result =>
        result.algorithm ===
          'hungarian' ||
        result.algorithm ===
          'global_optimization'
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
            Allocate technicians to
            service requests using
            constraint-aware
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
            activeTab ===
            'overview'
              ? 'active'
              : ''
          }
          onClick={() =>
            setActiveTab(
              'overview'
            )
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
            activeTab ===
            'allocation'
              ? 'active'
              : ''
          }
          onClick={() =>
            setActiveTab(
              'allocation'
            )
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

      {activeTab ===
        'overview' && (
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
                    <th>
                      Entity
                    </th>

                    <th>
                      Total
                    </th>

                    <th>
                      Selected
                    </th>

                    <th>
                      Scope
                    </th>
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
                      {
                        data
                          .resources
                          .length
                      }
                    </td>

                    <td>
                      {
                        selectedResources.size
                      }
                    </td>

                    <td>
                      {data
                        .resources
                        .length
                        ? `${Math.round(
                            (selectedResources.size /
                              data
                                .resources
                                .length) *
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
                      {
                        data
                          .requests
                          .length
                      }
                    </td>

                    <td>
                      {
                        selectedRequests.size
                      }
                    </td>

                    <td>
                      {data
                        .requests
                        .length
                        ? `${Math.round(
                            (selectedRequests.size /
                              data
                                .requests
                                .length) *
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
                      View existing
                      technicians and
                      requests or add new
                      ones.
                    </p>
                  </div>
                </div>

                <div className="workflowStep">
                  <span>2</span>

                  <div>
                    <strong>
                      Select allocation
                      scope
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
                      the appropriate global
                      optimization algorithm
                      against the selected
                      data.
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
                      ? (llmStatus?.used ? 'Latest LLM allocation' : 'Latest algorithm comparison')
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
                    Go to Allocation and
                    click Run Allocation.
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
                        {greedy.metrics
                          ?.coverage_pct?.toFixed(
                            1
                          )}
                        %
                      </strong>
                    </div>
                  )}

                  {optimized && (
                    <div>
                      <span>
                        {optimized.algorithm ===
                        'global_optimization'
                          ? 'Global Optimization'
                          : 'Hungarian'}{' '}
                        coverage
                      </span>

                      <strong>
                        {optimized.metrics
                          ?.coverage_pct?.toFixed(
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
                    View detailed
                    results →
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
                Manage technicians and
                service requests directly
                in the tables.
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
                    {
                      data
                        .resources
                        .length
                    }
                  </span>
                </div>
              </div>

              <ResourcesTable
                resources={
                  data.resources
                }
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
                    {
                      data
                        .requests
                        .length
                    }
                  </span>
                </div>
              </div>

              <RequestsTable
                requests={
                  data.requests
                }
                onSaved={refresh}
              />
            </section>
          </div>
        </section>
      )}

      {/* ======================================================
          ALLOCATION
          ====================================================== */}

      {activeTab ===
        'allocation' && (
        <section className="page">
          <div className="pageHeading">
            <div>
              <h2>
                Allocation
              </h2>

              <p>
                Select resources and
                requests, configure
                weights, and run allocation.
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
                      'global_optimization'
                        ? 'Global Optimization'
                        : selectedResult.algorithm ===
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
                    {selectedResult
                      .assignments
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
                    {selectedResult
                      .metrics
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
                    {selectedResult
                      .metrics
                      ?.avg_distance_km !=
                    null
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
                    {
                      selectedResources.size
                    }
                    /
                    {
                      data
                        .resources
                        .length
                    }
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
                      key={
                        resource.id
                      }
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
                        {
                          resource.id
                        }
                      </span>

                      <span className="selectionName">
                        {
                          resource.name
                        }
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
                    {
                      selectedRequests.size
                    }
                    /
                    {
                      data
                        .requests
                        .length
                    }
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
                      key={
                        request.id
                      }
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
                        {
                          request.id
                        }
                      </span>

                      <span className="selectionName">
                        {
                          request.title
                        }
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
                      {
                        weights.distance_weight
                      }
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
                              event.target
                                .value
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
                      {
                        weights.priority_weight
                      }
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
                              event.target
                                .value
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
                    {
                      selectedResources.size
                    }
                  </strong>
                </div>

                <div>
                  <span>
                    Requests
                  </span>

                  <strong>
                    {
                      selectedRequests.size
                    }
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
              {llmStatus && <p className="muted" role="status">{llmStatus.used ? "LLM engine used for allocation" : llmStatus.attempted ? `LLM allocation failed; deterministic algorithms used: ${llmStatus.fallback_reason}` : "Deterministic algorithms active (LLM not configured or disabled)"}</p>}
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
                  <div className="sectionActions" role="group" aria-label="Map assignment display">
                    <button type="button" className={mapMode === 'both' ? 'smallButton primary' : 'smallButton'} onClick={() => setMapMode('both')}>All displayed results</button>
                    {results.map(result => (
                      <button type="button" key={result.algorithm}
                        className={mapMode === result.algorithm ? 'smallButton primary' : 'smallButton'}
                        onClick={() => setMapMode(result.algorithm)}>
                        {result.algorithm === 'greedy' ? 'Greedy' : result.algorithm === 'llm' ? 'LLM' : result.algorithm === 'global_optimization' ? 'Global Optimization' : result.algorithm === 'scalable_heuristic' ? 'Scalable Deterministic' : 'Hungarian'}
                      </button>
                    ))}
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
                  results={results}
                  mapMode={mapMode}
                />
              </div>
            </section>
          </div>
        </section>
      )}

      {/* ======================================================
          RESULTS
          ====================================================== */}

      {activeTab ===
        'results' && (
        <section className="page">
          <div className="pageHeading">
            <div>
              <h2>
                Algorithm Comparison
              </h2>

              <p>
                Compare Greedy and the
                appropriate global optimization
                algorithm under the selected
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
                allocation results.
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

                {results.find(r => r.algorithm === 'scalable_heuristic') && (
                  <AlgorithmResult result={results.find(r => r.algorithm === 'scalable_heuristic')} />
                )}

                {results.find(r => r.algorithm === 'llm') && (
                  <AlgorithmResult result={results.find(r => r.algorithm === 'llm')} />
                )}

                {optimized && (
                  <AlgorithmResult
                    result={optimized}
                  />
                )}

                {greedy &&
                  optimized && (
                    <WinnerCard
                      greedy={greedy}
                      optimized={
                        optimized
                      }
                      winner={
                        allocationWinner
                      }
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

