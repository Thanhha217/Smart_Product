import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, ArrowLeft } from './icons';

export default function Pagination({ page, setPage, numberOfPages }) {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();

    const basePageBtnStyle = "min-w-10 min-h-10 px-1 rounded-md"

    const pageBtnStyle = basePageBtnStyle + " " + "bg-primary-100 border-2 border-primary-500 text-primary-900 hover:bg-primary-200 cursor-pointer transition duration-100 ease-in-out"
    const pageSelectedBtnStyle = basePageBtnStyle + " " + "bg-primary-500 text-primary-100"

    const pageDotsStyle = "min-w-8 min-h-10 text-center text-3xl"

    const pageSwitchBtnStyle = "flex h-10 w-10 items-center justify-center rounded-md text-primary-900 cursor-pointer text-3xl border-2 border-transparent cursor-pointer " + 
                               "hover:border-primary-500 transition duration-100 ease-in-out " + 
                               "disabled:text-primary-500 disabled:border-0 disabled:cursor-default"

    let pageNav = []
    let offset = 2

    if (page === 1) {
        pageNav.push(<button key={1} className={pageSelectedBtnStyle}>1</button>)
    } else {
        pageNav.push(<button key={1} className={pageBtnStyle} onClick={() => setPage(1)}>1</button>)
    }

    if (page - offset - 1 > 1) {
        pageNav.push(<p key="0" className={pageDotsStyle} >⋯</p>)
    }

    const minBoundary = Math.max(Math.min(page - offset, numberOfPages - (offset * 2 + 1)), 2);
    const maxBoundary = Math.min(Math.max(offset * 3, page + offset + 1), numberOfPages);

    for (let i = minBoundary; i < maxBoundary; i++) {
        if (i === page) {
            pageNav.push(<button key={i} className={pageSelectedBtnStyle}>{i}</button>)
        } else {
            pageNav.push(<button key={i} className={pageBtnStyle} onClick={() => setPage(i)}>{i}</button>)
        }
    }

    if (page + offset + 1 < numberOfPages) {
        pageNav.push(<p key="00" className={pageDotsStyle}>⋯</p>)
    }

    if (numberOfPages != 1) {
        if (page === numberOfPages) {
            pageNav.push(<button key={numberOfPages} className={pageSelectedBtnStyle}>{numberOfPages}</button>)
        } else {
            pageNav.push(<button key={numberOfPages} className={pageBtnStyle} onClick={() => setPage(numberOfPages)}>{numberOfPages}</button>)
        }
    }


    return (
        <div className="flex gap-4 justify-end items-center">
            <button className={pageSwitchBtnStyle} onClick={() => setPage(page-1)} disabled={page === 1}>
                <ArrowLeft/>
            </button>
            {pageNav}
            <button className={pageSwitchBtnStyle} onClick={() => setPage(page+1)} disabled={page === numberOfPages}>
                <ArrowRight/>
            </button>
        </div>
    );
}