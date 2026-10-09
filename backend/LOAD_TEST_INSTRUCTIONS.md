# Reproducible load benchmark

From PowerShell on Windows:

```powershell
cd C:\Git\resource-allocation-engine\backend
.\.venv\Scripts\python.exe benchmark_load.py --sizes 200000 --scenario matched --output load-results.json
```

The default `matched` scenario reproduces the simple one-to-one, equal-capability, aligned-location benchmark shape used for earlier scale measurements. 
The timing and memory readings will vary by machine and installed Python/Numpy/SciPy versions. 

To run a harder scenario separately:

```bash
python benchmark_load.py --sizes 5000 20000 --scenario geographic_and_skills --output mixed-results.json
```

Other scenarios: `capability_and_availability`, `one_to_many_conflicts`. Outputs are JSON records, rewritten after each completed test. 
They include dataset generation time, allocation time, validation time, total time, assigned/unassigned, coverage, and peak process RSS. 
Memory is a *process peak*, not a per-run incremental memory delta. Every assignment is checked against constraints. 
A nonzero exit or traceback means the benchmark did not pass. The script does not start FastAPI, write application datasets, or invoke any LLM; it benchmarks the allocator only. 
It cannot be cited as a full UI/API load test. The scalable strategy is heuristic, not an exact global optimum.
