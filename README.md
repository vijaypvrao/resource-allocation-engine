# Resource Allocation Engine

A constraint-aware resource allocation engine for matching field service technicians to service requests.

The application compares a **Greedy Heuristic** against globally optimized allocation strategies and provides transparent metrics, assignment explanations, and map visualization.

---

# Technology Stack

## Backend

* Python 3.10+
* FastAPI
* SciPy
* NumPy
* Mixed Integer Linear Programming (MILP)
* JSON-based local persistence

## Frontend

* React
* Vite
* Leaflet
* OpenStreetMap

---

# Steps to Start the Application

## Prerequisites

Make sure the following are installed:

* Python 3.10+
* Node.js
* npm

---

## 1. Start the Backend

Open a terminal and navigate to the backend directory:

```bash
cd backend
```

Create a Python virtual environment:

```bash
python -m venv .venv
```

Activate the virtual environment on Windows:

```bash
.venv\Scripts\activate
```

Install the required Python packages:

```bash
pip install -r requirements.txt
```

Start the FastAPI server:

```bash
uvicorn app.main:app --reload
```

The backend will normally be available at:

```text
http://localhost:8000
```

FastAPI Swagger documentation is available at:

```text
http://localhost:8000/docs
```

On the first backend start, the application creates:

```text
backend/data/store.json
```

This file is used for lightweight local persistence.

---

## 2. Start the Frontend

Open a **second terminal**:

```bash
cd frontend
```

Install the frontend dependencies:

```bash
npm install
```

Start the Vite development server:

```bash
npm run dev
```

The frontend will normally be available at:

```text
http://localhost:5173
```

---

## 3. Open the Application

Open the Vite URL in a browser:

```text
http://localhost:5173
```

The application is organized into four main areas:

* **Overview** — high-level application information and allocation summary
* **Data** — view and manage resources and requests
* **Allocation** — select resources and requests, configure the allocation mode and scoring weights, and run the assignment
* **Results** — compare algorithms, inspect metrics and assignments, determine the winner, and visualize the allocation on the map

---

## 4. Run an Allocation

A typical allocation run is:

1. Open **Data** and review the resources and requests.
2. Add resources or requests if required.
3. Select the resources that should participate.
4. Select the requests that should participate.
5. Select the assignment mode:

   * **One-to-One**
   * **One-to-Many**
6. Adjust distance and priority weights if required.
7. Click **Run Assignment**.
8. Open **Results**.
9. Compare the Greedy result with the optimization result.
10. Review:

    * Total score
    * Coverage
    * Total distance
    * Assigned requests
    * Unassigned requests
    * Assignment explanations
11. Inspect the selected allocation on the map.

---

# How the Engine Works

```text
                    +------------------+
                    |    Resources     |
                    +--------+---------+
                             |
                             |
                    +--------v---------+
                    | Allocation Engine|
                    +--------+---------+
                             ^
                             |
                    +--------+---------+
                    | Service Requests |
                    +------------------+

                             |
             +---------------+---------------+
             |                               |
             v                               v
    +------------------+             +----------------------+
    | Greedy Heuristic |             | Optimization Strategy|
    +--------+---------+             +----------+-----------+
             |                                  |
             |                     +------------+------------+
             |                     |                         |
             |                     v                         v
             |              +-------------+       +------------------+
             |              |  Hungarian  |       | MILP Global      |
             |              | One-to-One  |       | Optimization     |
             |              +------+------+       | One-to-Many      |
             |                     |              +--------+---------+
             +---------------------+-----------------------+
                                   |
                                   v
                         +----------------------+
                         | Allocation Results   |
                         +----------+-----------+
                                    |
              +---------------------+----------------------+
              |                     |                      |
              v                     v                      v
        +-----------+        +-------------+        +-------------+
        |  Metrics  |        | Explainability|       | Map         |
        +-----------+        +-------------+        +-------------+
```

The engine takes:

* Resources
* Service requests
* Resource capabilities
* Request requirements
* Availability windows
* Geographic locations
* Request priorities
* Configurable scoring weights
* Assignment mode

It then produces allocations using two different strategies.

---

# Allocation Strategies

| Assignment Mode | Heuristic        | Optimization                   |
| --------------- | ---------------- | ------------------------------ |
| One-to-One      | Greedy Heuristic | Hungarian Algorithm            |
| One-to-Many     | Greedy Heuristic | Global Optimization using MILP |

The optimization strategy depends on the selected assignment mode.

---

# One-to-One Allocation

In One-to-One mode:

* Each request can receive at most one resource.
* Each resource can be assigned to at most one request.
* A resource is consumed once assigned.
* Greedy and Hungarian solve the same feasible assignment problem using different strategies.

---

## Greedy Heuristic

The Greedy algorithm processes requests in priority order.

For each request:

1. Find compatible resources.
2. Calculate the score for every candidate.
3. Select the candidate with the highest score.
4. Assign the resource.
5. Remove the resource from the available pool.
6. Continue with the next request.

Greedy is fast and easy to understand.

However, it makes decisions locally and does not guarantee the best overall allocation.

For example, a resource that is the best choice for the current request may be the only viable resource for another request later.

---

## Hungarian Algorithm

The Hungarian algorithm solves the One-to-One assignment problem globally.

The engine creates a score matrix where:

* Rows represent requests.
* Columns represent resources.
* Each cell represents the score of assigning a resource to a request.
* Incompatible combinations are prohibited.
* Dummy/unassigned choices allow requests to remain unassigned when appropriate.

The objective is to maximize total allocation score.

Therefore, unlike Greedy, the algorithm considers the complete assignment rather than making independent local decisions.

---

# One-to-Many Allocation

In One-to-Many mode:

* A resource may serve multiple requests.
* A request may receive at most one resource.
* A resource can be reused for different requests.
* A resource cannot serve overlapping requests.
* Availability windows still have to be respected.

This models situations where a technician can perform several jobs during the day, provided the jobs do not conflict.

---

## One-to-Many Greedy

The Greedy algorithm can reuse resources in One-to-Many mode.

For each request:

1. Find compatible resources.
2. Calculate the candidate score.
3. Select the highest-scoring resource.
4. Reuse the resource when allowed.
5. Continue until all requests have been considered.

The algorithm is simple but does not reason globally about the complete schedule.

---

# Global Optimization using MILP

For One-to-Many allocation, the engine uses **Mixed Integer Linear Programming (MILP)**.

A binary decision variable is created for each feasible request-resource combination:

```text
x(request, resource) = 1
    if the resource is assigned to the request

x(request, resource) = 0
    otherwise
```

The optimization model enforces constraints such as:

## Request Constraint

A request can receive at most one resource:

```text
sum(resource assignments for request) <= 1
```

## Resource Overlap Constraint

A resource cannot be assigned to overlapping requests:

```text
x(request A, resource) + x(request B, resource) <= 1
```

when the two requests overlap in time.

## Optimization Objective

The optimization is performed in phases:

1. Maximize total allocation score.
2. Holding the maximum score fixed, maximize request coverage.

Total distance is then used as a further tie-breaker when comparing the final algorithm results.

**Important:** Total distance is currently **not** a third optimization phase inside the MILP model. It is used by the winner-determination logic after score and coverage are compared.

---

# Compatibility Rules

A resource is compatible with a request only when all required conditions are satisfied.

## Capability Compatibility

Every capability required by the request must exist on the resource.

Conceptually:

```text
request.requirements ⊆ resource.capabilities
```

For example:

```text
Request:
    electrical + security

Resource:
    electrical + security + networking
```

is compatible.

But:

```text
Request:
    electrical + security

Resource:
    electrical
```

is not compatible.

---

## Availability Compatibility

The resource must be available for the complete request time window:

```text
resource.available_from <= request.start

resource.available_until >= request.end
```

---

# Geographic Distance

The engine uses the **Haversine formula** to calculate the approximate great-circle distance between two geographic coordinates.

The distance is used as part of the allocation score and is also reported in the results.

This approach is appropriate for the assessment because it:

* Requires no external routing API.
* Is deterministic.
* Is computationally inexpensive.
* Provides a reasonable geographic proximity measure.

In a production system, actual road distance or travel time would normally be more appropriate.

---

# Scoring Model

Each compatible resource-request pair receives a score.

The current scoring model is:

```text
Score =
    Priority Bonus
    + Capability Bonus
    - Distance Penalty
```

## Priority Bonus

```text
Priority Bonus =
    priority_weight × request.priority
```

Higher-priority requests therefore receive a larger score contribution.

---

## Capability Bonus

```text
Capability Bonus =
    2 × number of required capabilities
```

This rewards requests that have more required capabilities, provided the resource satisfies them.

---

## Distance Penalty

```text
Distance Penalty =
    distance_weight × distance_km
```

A resource farther away therefore receives a lower score.

---

## Complete Formula

The current formula can therefore be represented as:

```text
Total Score =
    priority_weight × priority
    + 2 × number_of_requirements
    - distance_weight × distance_km
```

The distance and priority weights can be adjusted from the Allocation screen.

---

## Example

Assume:

```text
Priority = 4
Required capabilities = 2
Distance = 5 km
Priority weight = 2
Distance weight = 1
```

Then:

```text
Priority Bonus   = 2 × 4 = 8
Capability Bonus = 2 × 2 = 4
Distance Penalty = 1 × 5 = 5

Total Score = 8 + 4 - 5
            = 7
```

---

# Allocation Metrics

Every algorithm produces comparable metrics.

| Metric           | Description                                   |
| ---------------- | --------------------------------------------- |
| Total Requests   | Number of requests considered                 |
| Assigned         | Number of successfully assigned requests      |
| Unassigned       | Number of requests without an assignment      |
| Coverage %       | Percentage of requests assigned               |
| Average Distance | Average travel distance for assigned requests |
| Total Distance   | Total travel distance                         |
| Average Score    | Average score of assigned requests            |
| Total Score      | Sum of scores across all assignments          |

---

# Winner Determination

The winner is determined using a strict lexicographic hierarchy:

```text
1. Total Allocation Score
2. Request Coverage
3. Total Travel Distance
4. Tie
```

The most important metric is therefore **Total Score**.

Coverage is only used when total score is equal.

Total distance is only considered when both total score and coverage are equal.

If all three values are equivalent, the result is reported as a tie.

The Winner Card therefore shows **Total Score as the primary comparison**, rather than coverage.

---

# Why Total Score Comes First

The allocation score represents the business objective encoded by the scoring model.

It combines:

* Request priority
* Capability suitability
* Geographic distance

Therefore, comparing total score first means the winner is the algorithm that produced the allocation with the highest overall business value according to the configured scoring model.

Coverage alone is not sufficient.

For example, one algorithm could assign every request but produce poor matches with large travel distances, while another algorithm assigns fewer requests but produces substantially better matches.

The scoring model makes these trade-offs explicit.

---

# Important Optimization Principle

The optimized algorithm is solving the same feasible allocation problem with **Total Score as its primary objective**.

Therefore, with identical inputs and scoring weights:

> The optimized result should not have a lower total score than the Greedy result.

Greedy may sometimes achieve higher coverage because it makes different local choices.

However, if the optimizer is correctly configured with total score as its primary objective, its total score should be at least as good as the Greedy solution.

This is an important validation check when testing the engine.

---

# Application Features

## Overview

Provides a high-level view of:

* Application purpose
* Allocation modes
* Available resources
* Available requests
* Current allocation summary

---

## Data Management

The Data section allows users to:

* View resources
* View requests
* Add resources
* Add requests
* Review capabilities
* Review requirements
* Review availability
* Review geographic locations
* Select records for an allocation run

---

## Allocation Configuration

Users can configure:

* Selected resources
* Selected requests
* Assignment mode
* Distance weight
* Priority weight

The allocation can then be executed from the Allocation screen.

---

## Results Comparison

The Results section presents the two algorithms side by side.

Depending on the selected assignment mode, the optimized algorithm is:

* Hungarian for One-to-One
* Global Optimization for One-to-Many

Results include:

* Algorithm name
* Assignment count
* Coverage
* Total score
* Average score
* Total distance
* Average distance
* Assigned request/resource pairs
* Unassigned requests
* Assignment explanations

---

## Winner Card

The Winner Card compares the algorithms using the same decision hierarchy as the backend:

```text
1. Total Score
2. Coverage
3. Total Distance
4. Tie
```

The displayed winner is therefore based on the actual allocation metrics.

---

# Map Visualization

The application provides geographic visualization using Leaflet and OpenStreetMap.

Resources and requests are visually distinguished:

* **Blue markers** represent resources.
* **Red markers** represent requests.

The map also displays the selected assignments so that the geographic relationship between resources and requests can be inspected visually.

Each marker provides identifying information through a popup.

The map is intended primarily as an explainability and visualization feature rather than as the routing engine itself.

---

# Frontend Structure

The React frontend is organized around:

```text
Overview
Data
Allocation
Results
```

The frontend is responsible for:

* User interaction
* Data selection
* Allocation configuration
* Calling the FastAPI backend
* Displaying allocation results
* Rendering metrics
* Displaying explanations
* Rendering the allocation map

The frontend does not contain the core allocation logic.

The backend remains the source of truth for allocation decisions.

---

# Backend Structure

The backend exposes APIs for:

* Resources
* Requests
* Allocation
* Persistence

The allocation engine is separated from the API layer.

Conceptually:

```text
FastAPI API
    |
    v
Allocation Engine
    |
    +--> Greedy
    |
    +--> Hungarian
    |
    +--> MILP Global Optimization
    |
    v
Allocation Results
```

This separation makes the optimization logic easier to test independently of the UI.

---

# Persistence Design

The application uses a JSON file for lightweight local persistence:

```text
backend/data/store.json
```

This is intentionally simple for the assessment/demo.

The file stores application data such as:

* Resources
* Requests

Allocation results are generated dynamically from the selected inputs.

A production deployment would normally use a database rather than a local JSON file.

---

# Project Structure

A simplified project structure is:

```text
resource-allocation-engine/
│
├── backend/
│   ├── app/
│   │   ├── allocator.py
│   │   ├── main.py
│   │   └── models.py
│   │
│   ├── data/
│   │   └── store.json
│   │
│   └── requirements.txt
│
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── components/
│   │   └── ...
│   │
│   ├── package.json
│   └── ...
│
└── README.md
```

---

# Why Greedy?

Greedy is useful because it is:

* Simple
* Fast
* Easy to implement
* Easy to explain
* Suitable as a baseline

It provides a useful benchmark against more sophisticated optimization methods.

Its main limitation is that it does not consider the complete assignment globally.

---

# Why Hungarian?

The Hungarian algorithm is a natural choice for One-to-One assignment problems.

It provides a globally optimal assignment for the constructed score matrix.

Compared with Greedy:

```text
Greedy:
    Optimize each decision locally

Hungarian:
    Optimize the complete one-to-one assignment
```

This demonstrates the difference between a heuristic and a global optimization approach.

---

# Why MILP?

One-to-Many allocation introduces additional constraints.

A resource can be reused, but overlapping assignments must be prohibited.

MILP is appropriate because it allows the allocation problem to be represented using:

* Binary decision variables
* Assignment constraints
* Scheduling constraints
* An explicit optimization objective

This also makes it possible to extend the model with additional business constraints.

Examples include:

* Maximum technician workload
* Skill levels
* Service territories
* Break periods
* Travel time
* Equipment requirements
* Cost limits
* Customer SLAs

---

# Why Python?

Python was selected primarily because of its mature optimization ecosystem.

SciPy provides optimization primitives such as:

* `linear_sum_assignment`
* `milp`

This makes it possible to implement meaningful optimization logic without introducing a large external optimization stack.

Python also provides a concise environment for mathematical and optimization-oriented development.

---

# Explainability

The engine does not return only an assignment.

Each assignment includes reasons such as:

* Travel distance
* Request priority
* Capability compatibility
* Whether the resource is reusable under One-to-Many
* Whether the assignment was selected by global optimization

This makes the result easier to understand and demonstrate.

Explainability is particularly important in resource allocation because users often need to understand why a particular technician was selected.

---

# Testing

The allocation engine should be tested using scenarios covering:

## Basic Matching

A request has exactly one compatible resource.

Expected:

```text
The compatible resource is selected.
```

## Multiple Compatible Resources

Several resources can satisfy a request.

Expected:

```text
The highest-scoring resource should be preferred.
```

## Capability Mismatch

No resource has all required capabilities.

Expected:

```text
The request remains unassigned.
```

## Availability Mismatch

A resource has the required capabilities but is unavailable during the request window.

Expected:

```text
The resource is not considered compatible.
```

## One-to-One Resource Competition

Two requests compete for the same resource.

Expected:

```text
Greedy and Hungarian may produce different assignments.
```

## One-to-Many Reuse

Multiple requests can be served by the same resource.

Expected:

```text
The resource can serve multiple non-overlapping requests.
```

## One-to-Many Overlap

Two requests require the same resource at overlapping times.

Expected:

```text
The resource cannot be assigned to both requests.
```

## Weight Changes

Changing the distance or priority weights should be capable of changing preferred assignments.

---

# Design Trade-offs

## Haversine vs Real Routing

### Current approach

Use Haversine distance.

### Advantages

* Simple
* Fast
* No external API dependency
* Deterministic

### Limitation

Straight-line distance does not represent actual road travel.

### Production improvement

Use a routing engine or travel-time matrix.

---

## JSON vs Database

### Current approach

JSON persistence.

### Advantages

* Very simple
* Easy to inspect
* No database setup

### Limitation

Not appropriate for concurrent or large-scale production workloads.

### Production improvement

Use PostgreSQL or another transactional database.

---

## SciPy MILP vs Dedicated Solver

### Current approach

SciPy MILP.

### Advantages

* Simple dependency footprint
* Easy integration with Python
* Suitable for this demonstration

### Limitation

Large industrial optimization problems may require specialized solvers.

### Production improvement

Evaluate solvers such as HiGHS, Gurobi, or CPLEX depending on scale, licensing, and performance requirements.

---

# Production Considerations

A production implementation would require additional capabilities.

## Data Layer

Replace JSON persistence with a database.

## Authentication and Authorization

Secure resource and request management APIs.

## Input Validation

Validate:

* Coordinates
* Time windows
* Capabilities
* Priorities
* Weights
* Assignment selections

## Observability

Add:

* Structured logging
* Metrics
* Tracing
* Error monitoring

## Optimization Limits

Large allocation problems may require:

* Solver time limits
* Candidate filtering
* Problem decomposition
* Caching
* Incremental optimization

## Real Travel Information

Replace straight-line distance with:

* Road distance
* Estimated travel time
* Traffic-aware routing where appropriate

## Business Calibration

Scoring weights should ultimately be calibrated against real business priorities rather than arbitrary demonstration values.

---

# Key Design Decision

The most important design decision is to separate:

```text
Business objective
        |
        v
Scoring model
        |
        v
Feasibility constraints
        |
        v
Allocation strategy
        |
        v
Evaluation metrics
```

This separation makes the system easier to evolve.

For example, the scoring model can change without fundamentally changing the API or frontend.

Likewise, a new optimization strategy can be introduced while keeping the same allocation result contract.

---

# Summary

The Resource Allocation Engine demonstrates how a practical allocation problem can be modeled using both heuristic and optimization-based approaches.

The application supports:

* Resource/request compatibility
* Capability matching
* Availability constraints
* Geographic distance
* Configurable scoring
* One-to-One allocation
* One-to-Many allocation
* Greedy allocation
* Hungarian optimization
* MILP global optimization
* Transparent metrics
* Winner determination
* Assignment explanations
* Geographic visualization
* Lightweight persistence

The project is intentionally designed to demonstrate not only algorithm implementation, but also engineering considerations around **constraints, optimization objectives, explainability, API design, frontend integration, testing, and production trade-offs**.
