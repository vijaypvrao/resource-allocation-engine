from __future__ import annotations

def determine_winner(
    greedy_metrics: dict,
    optimized_metrics: dict
) -> dict:

    greedy_score = float(
        greedy_metrics.get("total_score", 0.0)
    )

    optimized_score = float(
        optimized_metrics.get("total_score", 0.0)
    )

    greedy_coverage = float(
        greedy_metrics.get("coverage_pct", 0.0)
    )

    optimized_coverage = float(
        optimized_metrics.get("coverage_pct", 0.0)
    )

    greedy_distance = float(
        greedy_metrics.get(
            "total_distance_km",
            float("inf")
        )
    )

    optimized_distance = float(
        optimized_metrics.get(
            "total_distance_km",
            float("inf")
        )
    )

    optimized_algorithm = optimized_metrics.get(
        "algorithm",
        "optimized"
    )

    if optimized_score > greedy_score:

        winner = optimized_algorithm
        reason = "Higher total allocation score"

    elif greedy_score > optimized_score:

        winner = "greedy"
        reason = "Higher total allocation score"

    elif optimized_coverage > greedy_coverage:

        winner = optimized_algorithm
        reason = (
            "Equal total allocation score, "
            "higher request coverage"
        )

    elif greedy_coverage > optimized_coverage:

        winner = "greedy"
        reason = (
            "Equal total allocation score, "
            "higher request coverage"
        )

    elif optimized_distance < greedy_distance:

        winner = optimized_algorithm
        reason = (
            "Equal score and coverage, "
            "lower total travel distance"
        )

    elif greedy_distance < optimized_distance:

        winner = "greedy"
        reason = (
            "Equal score and coverage, "
            "lower total travel distance"
        )

    else:

        winner = "tie"
        reason = (
            "Both algorithms produced "
            "equivalent allocation results"
        )

    return {
        "winner": winner,
        "reason": reason,

        # Primary decision metric
        "total_score": {
            "greedy": greedy_score,
            "optimized": optimized_score
        },

        # Secondary decision metric
        "coverage": {
            "greedy": greedy_coverage,
            "optimized": optimized_coverage
        },

        # Tertiary decision metric
        "total_distance_km": {
            "greedy": greedy_distance,
            "optimized": optimized_distance
        },

        # Explicitly tell the UI which optimization algorithm is being compared
        "optimized_algorithm": optimized_algorithm,

        # Useful for displaying the decision hierarchy in the UI
        "decision_priority": [
            "total_score",
            "coverage",
            "total_distance_km"
        ]
    }    
