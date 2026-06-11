import { useState, useEffect, useCallback, useRef } from "react";
import Shell from "../components/Shell";
import Icon from "../components/ui/Icon";
import { Skeleton } from "../components/ui/Skeleton";
import { jobsAPI } from "../services/jobs";
import type { Job, JobsResponse, WorkResult } from "../services/jobs";
import { toast } from "../utils/toast";
import { userEvents } from "../utils/userEvents";
import "../styles/Job.css";

export default function JobsPage() {
  const [data, setData] = useState<JobsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  const loadRef = useRef<() => void>(() => {});
  const load = useCallback(() => {
    setError(null); setLoading(true);
    jobsAPI.list()
      .then(setData)
      .catch((err: unknown) => { const m = err instanceof Error ? err.message : "Failed to load jobs"; setError(m); toast.error(m); })
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { loadRef.current = load; }, [load]);
  useEffect(() => { loadRef.current(); }, []);

  const handleApply = async (jobId: number) => {
    try {
      await jobsAPI.apply(jobId);
      toast.success("Applied for job!");
      loadRef.current();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Application failed");
    }
  };

  const handleWork = async () => {
    setWorking(true);
    try {
      const res: WorkResult = await jobsAPI.work();
      toast.success(`Earned $${res.pay.toLocaleString()}`);
      userEvents.emit({ money: res.money, energy: res.energy });
      loadRef.current();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Work failed");
    } finally { setWorking(false); }
  };

  const handleQuit = async () => {
    try {
      await jobsAPI.quit();
      toast.success("Quit job");
      loadRef.current();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to quit");
    }
  };

  if (loading) return <Shell><div className="job-container"><div className="job-header"><h1 className="job-title"><Icon name="job" size={28} className="icon-accent" /> Jobs</h1></div><Skeleton width={200} height={4} /></div></Shell>;
  if (error) return <Shell><div className="job-error" role="alert"><p>{error}</p><button className="job-retry-btn" onClick={load}>Retry</button></div></Shell>;

  return (
    <Shell>
      <div className="job-container">
        <div className="job-header">
          <h1 className="job-title"><Icon name="job" size={26} className="icon-accent" /> Jobs</h1>
        </div>

        {data?.currentJob ? (
          <div className="job-current-card">
            <h3 className="job-current-title">{data.currentJob.name}</h3>
            <p className="job-current-desc">Pay: ${data.currentJob.pay}/work &middot; Energy: {data.currentJob.energy_cost}</p>
            <p className="job-current-desc">Started: {new Date(data.currentJob.started_at).toLocaleDateString()}</p>
            <div className="job-current-actions">
              <button className="job-work-btn" disabled={working} onClick={() => void handleWork()}>{working ? "Working..." : "Work"}</button>
              <button className="job-quit-btn" onClick={() => void handleQuit()}>Quit</button>
            </div>
          </div>
        ) : (
          <p className="job-desc">Find a job below, or work at one you're qualified for.</p>
        )}

        <div className="job-list">
          {data?.jobs.map((job: Job) => (
            <div key={job.id} className={`job-card ${!job.qualified ? "job-card-disabled" : ""}`}>
              <div className="job-card-header">
                <h3 className="job-name">{job.name}</h3>
                {data?.currentJob?.id === job.id && <span className="job-badge">Current</span>}
              </div>
              <p className="job-desc-text">{job.description}</p>
              <div className="job-details">
                <span>${job.pay}/work</span>
                <span>{job.energy_cost} energy</span>
                <span>Lvl {job.min_level}</span>
                {job.min_stats > 0 && <span>{job.min_stats} stats</span>}
              </div>
              {data?.currentJob?.id !== job.id && (
                <button
                  className="job-apply-btn"
                  disabled={!job.qualified}
                  onClick={() => void handleApply(job.id)}
                >
                  {job.qualified ? "Apply" : "Not Qualified"}
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </Shell>
  );
}

