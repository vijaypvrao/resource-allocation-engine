import { useEffect, useState } from "react";
import { API } from "../config.js";

export default function useAllocationController() {

  const [data, setData] =
    useState(null);

  const [results, setResults] =
    useState([]);

  const [activeTab, setActiveTab] =
    useState('overview');

  const [selectedResult, setSelectedResult] =
    useState(null);
  const [mapMode, setMapMode] = useState('both');

  const [allocationWinner, setAllocationWinner] =
    useState(null);

  const [weights, setWeights] =
    useState({
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

      const json =
        await response.json();

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
            resource =>
              resource.id
          )
        )
      );

      setSelectedRequests(
        new Set(
          json.requests.map(
            request =>
              request.id
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
      const next =
        new Set(previous);

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
            'Content-Type':
              'application/json'
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

      const json =
        await response.json();

      if (!response.ok) {
        throw new Error(
          json.detail ||
            'Allocation failed'
        );
      }

      setData({
        resources:
          json.resources,
        requests:
          json.requests
      });

      setResults(
        json.results
      );

      setAllocationWinner(
        json.winner
      );

      const preferredResult =
        json.results.find(
          result =>
            result.algorithm ===
              'hungarian' ||
            result.algorithm ===
              'global_optimization'
        ) ||
        json.results[0];

      setSelectedResult(
        preferredResult
      );

      setActiveTab(
        'allocation'
      );
    } catch (
      allocationError
    ) {
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

  return { data, results, activeTab, selectedResult, mapMode, allocationWinner, weights, assignmentMode, selectedResources, selectedRequests, loading, error, setActiveTab, setSelectedResult, setMapMode, setWeights, setAssignmentMode, setSelectedResources, setSelectedRequests, refresh, toggle, run };
}
