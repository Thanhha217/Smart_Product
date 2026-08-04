import { useEffect, useRef, useState } from "react";
import { useI18n } from "../../../i18n/LanguageContext";

export default function ImpagePopup({ open, onClose, onSelect }) {
    const inputRef = useRef(null);
    const [selectedFile, setSelectedFile] = useState(null);
    const [isDragging, setIsDragging] = useState(false);
    // Lưu KEY chứ không lưu câu đã dịch, để lỗi tự đổi ngôn ngữ theo switcher
    const [errorKey, setErrorKey] = useState("");
    const { t } = useI18n();

    useEffect(() => {
        if (!open) {
            setSelectedFile(null);
            setIsDragging(false);
            setErrorKey("");
        }
    }, [open]);

    if (!open) {
        return null;
    }

    const validateAndStoreFile = (file) => {
        if (!file) {
            return;
        }

        if (!file.type.startsWith("image/")) {
            setErrorKey("search.image.errorType");
            setSelectedFile(null);
            return;
        }

        setErrorKey("");
        setSelectedFile(file);
    };

    const handleFileChange = (event) => {
        validateAndStoreFile(event.target.files?.[0]);
    };

    const handleDrop = (event) => {
        event.preventDefault();
        setIsDragging(false);
        validateAndStoreFile(event.dataTransfer.files?.[0]);
    };

    const handleSubmit = () => {
        if (!selectedFile) {
            setErrorKey("search.image.errorEmpty");
            return;
        }

        onSelect(selectedFile);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-primary-900/60 px-4" role="presentation" onClick={onClose}>
            <div
                className="w-full max-w-xl rounded-3xl bg-primary-100 p-6 shadow-2xl"
                role="dialog"
                aria-modal="true"
                aria-labelledby="image-upload-title"
                onClick={(event) => event.stopPropagation()}
            >
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <p id="image-upload-title" className="text-2xl font-bold text-primary-900">{t("search.image.title")}</p>
                        <p className="mt-1 text-sm text-primary-800">{t("search.image.subtitle")}</p>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-full px-3 py-1 w-10 h-10  text-md  text-primary-800 hover:bg-primary-200"
                        aria-label={t("search.image.close")}
                    >
                        🗙
                    </button>
                </div>

                <div
                    className={`mt-6 flex min-h-56 cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed p-6 text-center transition duration-100 ease-in-out ${isDragging ? "border-secondary-500 bg-secondary-500/10" : "border-primary-200 bg-primary-100 hover:border-secondary-500"}`}
                    onClick={() => inputRef.current?.click()}
                    onDragEnter={(event) => {
                        event.preventDefault();
                        setIsDragging(true);
                    }}
                    onDragOver={(event) => {
                        event.preventDefault();
                        setIsDragging(true);
                    }}
                    onDragLeave={(event) => {
                        event.preventDefault();
                        setIsDragging(false);
                    }}
                    onDrop={handleDrop}
                >
                    {selectedFile ?
                        (<img src={URL.createObjectURL(selectedFile)} className="bg-white border-2 border-secondary-500 max-h-50 max-w-100"/>)
                        :
                        (
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                fill="none"
                                viewBox="0 0 24 24"
                                strokeWidth="1.8"
                                stroke="currentColor"
                                className="h-12 w-12 text-secondary-700"
                                aria-hidden="true"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l.372.372a2.25 2.25 0 003.182 0l4.159-4.159a2.25 2.25 0 013.182 0L21.75 9.75m-19.5 6v2.25A2.25 2.25 0 004.5 20.25h15A2.25 2.25 0 0019.5 5.25h-15A2.25 2.25 0 002.25 7.5v8.25z"
                                />
                            </svg>
                        )
                    }

                    <p className="mt-4 text-lg font-semibold text-primary-900">{t("search.image.drop")}</p>
                    <p className="mt-1 text-sm text-primary-800">{t("search.image.browse")}</p>

                    {selectedFile ? (
                        <p className="mt-4 rounded-full bg-primary-200 px-4 py-2 text-sm text-primary-900">
                            {t("search.image.selected", { name: selectedFile.name })}
                        </p>
                    ) : null}

                    {errorKey ? (
                        <p className="mt-4 text-sm font-medium text-red-600">{t(errorKey)}</p>
                    ) : null}

                    <input
                        ref={inputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleFileChange}
                    />
                </div>

                <div className="mt-6 flex flex-wrap justify-end gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-full border border-primary-200 px-4 py-2 font-medium text-primary-900 hover:bg-primary-200"
                    >
                        {t("search.image.cancel")}
                    </button>
                    <button
                        type="button"
                        onClick={handleSubmit}
                        className="rounded-full bg-secondary-500 px-5 py-2 font-medium text-primary-100 hover:bg-secondary-700"
                    >
                        {t("search.image.use")}
                    </button>
                </div>
            </div>
        </div>
    );
}
