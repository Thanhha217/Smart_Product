import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, ArrowLeft } from './icons';
import { useI18n } from '../../../i18n/LanguageContext';

export default function Pagination({ page, setPage, numberOfPages }) {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { t } = useI18n();

    const basePageBtnStyle = "min-w-10 min-h-10 px-1 rounded-md"

    const pageBtnStyle = basePageBtnStyle + " " + "bg-primary-100 border-2 border-primary-500 text-primary-900 hover:bg-primary-200 cursor-pointer transition duration-100 ease-in-out"
    const pageSelectedBtnStyle = basePageBtnStyle + " " + "bg-primary-500 text-primary-100"

    const pageDotsStyle = "min-w-8 min-h-10 text-center text-3xl"

    const pageSwitchBtnStyle = "flex h-10 w-10 items-center justify-center rounded-md text-primary-900 cursor-pointer text-3xl border-2 border-transparent cursor-pointer " + 
                               "hover:border-primary-500 transition duration-100 ease-in-out " + 
                               "disabled:text-primary-500 disabled:border-0 disabled:cursor-default"

    let pageNav = []
    let offset = 1

    const minBoundary = Math.max(Math.min(numberOfPages - 2 - offset*2, page - offset), 3);
    const maxBoundary = Math.min(Math.max(4 + offset*2, page + offset + 1), numberOfPages - 1);

    function createPageSlot(pageNumber) {
        if (pageNumber === page) {
            pageNav.push(<button key={pageNumber} className={pageSelectedBtnStyle}>{pageNumber}</button>)
        } else {
            pageNav.push(<button key={pageNumber} className={pageBtnStyle} onClick={() => setPage(pageNumber)}>{pageNumber}</button>)
        }
    }

    createPageSlot(1)

    if (numberOfPages > 2) {
        if (minBoundary > 3) {
            pageNav.push(<p key="0" className={pageDotsStyle} >⋯</p>)
        } else {
            createPageSlot(2)
        }
    }
    

    


    for (let i = minBoundary; i < maxBoundary; i++) {
        createPageSlot(i)
    }
    
    if (numberOfPages > 3) {
        if (maxBoundary - 1 < numberOfPages - 2) {
            pageNav.push(<p key="00" className={pageDotsStyle}>⋯</p>)
        } else {
            createPageSlot(numberOfPages - 1)
        }
    }
    

    if (numberOfPages != 1) {
        createPageSlot(numberOfPages)
    }


    return (
        <div className="flex justify-end items-center">
            <div className="flex gap-2 justify-between items-center">
                <button className={pageSwitchBtnStyle} onClick={() => setPage(page-1)} disabled={page === 1} aria-label={t("pagination.prev")}>
                    <ArrowLeft/>
                </button>
                {pageNav}
                <button className={pageSwitchBtnStyle} onClick={() => setPage(page+1)} disabled={page === numberOfPages} aria-label={t("pagination.next")}>
                    <ArrowRight/>
                </button>
            </div>
        </div>
    );
}