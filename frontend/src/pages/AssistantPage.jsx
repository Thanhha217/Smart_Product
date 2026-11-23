import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams, Link } from "react-router-dom";
import { useI18n } from "../i18n/LanguageContext";
import { explore } from "../i18n/explore";
import { api, MOCK_API } from "../api/client";
import { addHistory } from "../lib/storage";
import PageRenderer, { PageSkeleton } from "./components/assistant/PageRenderer";
import { ErrorState, InlineSpinner, SampleDataNote } from "./components/common/States";

// /assistant/:id — the AI-generated result page; shareable and reloadable.
export default function AssistantPage() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { t, lang } = useI18n();
  const X = explore(lang);
  const statePage = location.state?.page;
  const preloaded = statePage && statePage.id === id ? statePage : null;
  const [page, setPage] = useState(preloaded);
  const [error, setError] = useState(null);      // null | "missing" | "error"
  const [followError, setFollowError] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (preloaded) {
      setPage(preloaded);
      return undefined;
    }
    let cancelled = false;
    setPage(null);
    setError(null);
    api
      .getAssistantPage(id)
      .then((res) => {
        if (cancelled) return;
        if (res?.page) setPage(res.page); else setError("missing");
      })
      .catch((e) => !cancelled && setError(e?.status === 404 ? "missing" : "error"));
    return () => { cancelled = true; };
  }, [id, preloaded, nonce]);

  /** Resolves true on success so the follow-up box can keep the text on failure. */
  const followUp = async (message) => {
    if (updating) return false;
    setUpdating(true);
    setFollowError(false);
    try {
      const res = await api.askAssistant({ message, lang, parent_id: id });
      if (!res?.id) throw new Error("no page id");
      addHistory({ id: res.id, query: message });
      navigate(`/assistant/${res.id}`, { state: { page: res.page } });
      return true;
    } catch {
      setFollowError(true);
      return false;
    } finally {
      setUpdating(false);
    }
  };

  return (
    <main className="page-wrap py-6 flex flex-col gap-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <Link to="/assistant" className="text-[#1F5D3A] hover:underline text-[15px]">← {t("page.back")}</Link>
        {MOCK_API && <SampleDataNote />}
      </div>
      {error === "missing" && (
        <ErrorState title={t("page.notFound")} body={X.noResultsBody} />
      )}
      {error === "error" && <ErrorState title={X.pageErrorTitle} body={X.pageErrorBody} onRetry={() => setNonce((n) => n + 1)} />}
      {updating && <InlineSpinner label={X.pageUpdating} />}
      {followError && <ErrorState compact title={X.askTitle} body={X.followError} />}
      {page ? <PageRenderer page={page} onFollowUp={followUp} followUpLoading={updating} /> : !error && <PageSkeleton />}
    </main>
  );
}
