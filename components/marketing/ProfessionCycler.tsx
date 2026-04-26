'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import styles from './ProfessionCycler.module.css';

const PROFESSIONS = [
  'Doctor',
  'Attorney',
  'Architect',
  'Engineer',
  'Carpenter',
  'Consultant',
  'Journalist',
  'Trader',
  'Founder',
  'Nurse',
  'Designer',
  'Profession',
];

// How long to hold each item before advancing to the next (ms).
// Index matches PROFESSIONS. The last item ("Profession") holds forever.
const HOLD_MS = [100, 100, 100, 100, 100, 100, 100, 100, 100, 130, 180];

const SESSION_KEY = 'pos-animation-played';

export default function ProfessionCycler() {
  const [iconVisible, setIconVisible] = useState(false);
  const [textVisible, setTextVisible] = useState(false);
  const [index, setIndex] = useState(0);
  // Key changes on each word swap to restart the CSS flicker animation
  const [flickerKey, setFlickerKey] = useState(0);

  useEffect(() => {
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const alreadyPlayed = sessionStorage.getItem(SESSION_KEY) === '1';

    if (prefersReduced || alreadyPlayed) {
      // Skip to final state immediately
      setIndex(PROFESSIONS.length - 1);
      setIconVisible(true);
      setTextVisible(true);
      return;
    }

    // Phase 1: fade in the icon mark
    setIconVisible(true);

    // Phase 2: after ~300ms icon hold, show text and begin cycling
    const startTimer = setTimeout(() => {
      setTextVisible(true);

      let i = 0;

      const advance = () => {
        i += 1;
        setIndex(i);
        setFlickerKey((k) => k + 1); // triggers CSS flicker animation via key remount

        if (i < PROFESSIONS.length - 1) {
          setTimeout(advance, HOLD_MS[i]);
        } else {
          // Landed on "Profession OS" — mark session so it won't replay
          sessionStorage.setItem(SESSION_KEY, '1');
        }
      };

      setTimeout(advance, HOLD_MS[0]);
    }, 300);

    return () => clearTimeout(startTimer);
  }, []);

  return (
    <div className={styles.cycler} aria-label="Profession OS">
      <div
        className={styles.icon}
        data-visible={String(iconVisible)}
        aria-hidden="true"
      >
        <Image
          src="/brand/logo-icon.svg"
          alt=""
          width={48}
          height={48}
          priority
        />
      </div>
      <div
        className={styles.text}
        data-visible={String(textVisible)}
        aria-live="off"
        aria-hidden="true"
      >
        {/* key change forces remount → CSS flicker animation restarts on each swap */}
        <span className={styles.prefix} key={flickerKey}>
          {PROFESSIONS[index]}
        </span>
        <span className={styles.suffix}>&nbsp;OS</span>
      </div>
    </div>
  );
}
