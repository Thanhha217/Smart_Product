import React from 'react';
import styles from './Throbber.module.css';

export default function Throbber() {
    return (
        <div className={`${styles.loader}`}></div>
    )
}