import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams, Link } from "react-router-dom";
import { useI18n } from "../i18n/LanguageContext";
import { api, MOCK_API } from "../api/client";
import { addHistory } from "../lib/storage";
import PageRenderer, { PageSkeleton } from "./components/assistant/PageRenderer";

// /assistant/:id — the AI-generated result page; shareable and reloadable.
export default function AssistantPage() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { t, lang } = useI18n();
  const statePage = location.state?.page;
  const preloaded = statePage && statePage.id === id ? statePage : null;
  const [page, setPage] = useState(preloaded);
  const [error, setError] = useState("");
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    if (preloaded) {
      setPage(preloaded);
      return;
    }
    let cancelled = false;
    setPage(null);
    setError("");
    api
      .getAssistantPage(id)
      .then((res) => !cancelled && setPage(res.page))
      .catch((e) => !cancelled && setError(e.status === 404 ? t("page.notFound") : t("assistant.error")));
    return () => {
      cancelled = true;
    };
  }, [id, preloaded, t]);

  const followUp = async (message) => {
    setUpdating(true);
    setError("");
    try {
      const res = await api.askAssistant({ message, lang, parent_id: id });
      addHistory({ id: res.id, query: message });
      navigate(`/assistant/${res.id}`, { state: { page: res.page } });
    } catch {
      setError(t("assistant.error"));
    } finally {
      setUpdating(false);
    }
  };

  return (
    <main className="max-w-6xl mx-auto px-4 py-6 flex flex-col gap-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <Link to="/assistant" className="text-primary-500 hover:underline text-sm">← {t("page.back")}</Link>
        {MOCK_API && <span className="text-xs bg-purple-100 text-purple-800 rounded-full px-2 py-0.5">{t("mock.badge")}</span>}
      </div>
      {error && <p className="text-red-600">{error}</p>}
      {updating && <p className="text-sm text-gray-600">{t("assistant.loading")}</p>}
      {page ? <PageRenderer page={page} onFollowUp={followUp} followUpLoading={updating} /> : !error && <PageSkeleton />}
    </main>
  );
}
