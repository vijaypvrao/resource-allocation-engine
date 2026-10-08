import React from 'react';
export function AlgorithmResult({ result }) {
  const isGlobalOptimization =
    result.algorithm ===
    'global_optimization';

  const algorithmName =
    result.algorithm === 'greedy'
      ? 'Greedy'
      : isGlobalOptimization
        ? 'Global Optimization'
        : 'Hungarian';

  const algorithmBadge =
    result.algorithm === 'greedy'
      ? 'HEURISTIC'
      : 'GLOBAL OPTIMIZATION';

  const algorithmDescription =
    result.algorithm === 'greedy'
      ? 'Builds an assignment incrementally using the best available match.'
      : isGlobalOptimization
        ? 'Finds a globally optimal assignment while respecting resource reuse and scheduling constraints.'
        : 'Finds the globally optimal one-to-one assignment.';

  return (
    <section className="algorithmCard">
      <div className="algorithmCardHeader">
        <div>
          <span className="algorithmBadge">
            {algorithmBadge}
          </span>

          <h2>
            {algorithmName}
          </h2>

          <p className="algorithmDescription">
            {algorithmDescription}
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
            {result.metrics
              ?.avg_distance_km != null
              ? `${result.metrics.avg_distance_km.toFixed(
                  2
                )} km`
              : '—'}
          </strong>
        </div>

        <div className="metric">
          <span>Coverage</span>

          <strong>
            {result.metrics
              ?.coverage_pct != null
              ? `${result.metrics.coverage_pct.toFixed(
                  1
                )}%`
              : '—'}
          </strong>
        </div>

        <div className="metric">
          <span>Total Score</span>

          <strong>
            {result.metrics
              ?.total_score != null
              ? result.metrics.total_score.toFixed(
                  2
                )
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

        {result.assignments?.map(
          assignment => (
            <div
              className="algorithmAssignment"
              key={`${assignment.request_id}-${assignment.resource_id}`}
            >
              <span>
                {assignment.request_id}
              </span>

              <span className="assignmentArrow">
                →
              </span>

              <strong>
                {assignment.resource_id}
              </strong>

              <small>
                {assignment.distance_km != null
                  ? `${assignment.distance_km.toFixed(
                      2
                    )} km`
                  : '—'}
                {' · '}
                {assignment.score != null
                  ? assignment.score.toFixed(
                      3
                    )
                  : '—'}
              </small>
            </div>
          )
        )}
      </div>

      {result.unassigned_request_ids
        ?.length > 0 && (
        <div className="unassignedSection">
          <div className="algorithmSectionTitle">
            Unassigned

            <span>
              {
                result
                  .unassigned_request_ids
                  .length
              }
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

export function WinnerCard({
  greedy,
  optimized,
  winner
}) {
  const greedyMetrics =
    greedy?.metrics || {};

  const optimizedMetrics =
    optimized?.metrics || {};

  const optimizedLabel =
    optimized?.algorithm ===
    'global_optimization'
      ? 'Global Optimization'
      : 'Hungarian';

  const winnerName =
    winner?.winner ===
    'global_optimization'
      ? 'Global Optimization'
      : winner?.winner ===
        'hungarian'
        ? 'Hungarian'
        : winner?.winner ===
          'greedy'
          ? 'Greedy'
          : 'Tie';

  const greedyScore =
    greedyMetrics.total_score ?? 0;

  const optimizedScore =
    optimizedMetrics.total_score ?? 0;

  const greedyCoverage =
    greedyMetrics.coverage_pct ?? 0;

  const optimizedCoverage =
    optimizedMetrics.coverage_pct ?? 0;

  const greedyDistance =
    greedyMetrics.total_distance_km ?? 0;

  const optimizedDistance =
    optimizedMetrics.total_distance_km ?? 0;

  const scoreDifference =
    Math.abs(
      greedyScore - optimizedScore
    ).toFixed(2);

  const coverageWinner =
    greedyCoverage > optimizedCoverage
      ? 'Greedy'
      : optimizedCoverage > greedyCoverage
        ? optimizedLabel
        : 'Tie';

  const distanceWinner =
    greedyDistance < optimizedDistance
      ? 'Greedy'
      : optimizedDistance < greedyDistance
        ? optimizedLabel
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
          <span>
            {optimizedLabel}
          </span>

          <strong>
            {optimizedScore.toFixed(2)}
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
          <span>
            Total Score
          </span>

          <strong>
            {winnerName}

            {winnerName !== 'Tie' &&
              ` by ${scoreDifference}`}
          </strong>
        </div>

        <div className="winnerReason">
          <span>
            Coverage
          </span>

          <strong>
            {coverageWinner}
          </strong>
        </div>

        <div className="winnerReason">
          <span>
            Total Distance
          </span>

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
