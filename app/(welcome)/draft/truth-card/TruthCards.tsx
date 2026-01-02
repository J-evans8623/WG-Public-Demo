'use client';

/**
 * @file TruthCards.tsx
 * @description
 *   Landing-page “Truth Cards” section for WiseGraph. Renders a 3-card grid that
 *   matches the planner-stage aesthetic by layering content on top of the shared
 *   background texture image (public/textures/truthcardbg.png) while keeping
 *   typography clean, minimal, and evidence-forward.
 */

import React from 'react';
import './truth-cards.css';

export type TruthCardModel = {
  id: string;
  accentColor: string; // left rail
  topBadges: string[]; // small pills near top-left (e.g. ["200%", "retention"])
  bigNumber: string; // e.g. "+1", "200%", "22%"
  tagLine?: string; // small label under bigNumber (e.g. "letter grade GPA")
  statement: string; // main claim sentence(s)
  citationLine1: string; // journal / source line
  citationLine2: string; // author + year
};

const DEFAULT_CARDS: TruthCardModel[] = [
  {
    id: 'routine-gpa',
    accentColor: '#5B8C5A', // sage
    topBadges: ['+1', 'letter grade GPA'],
    bigNumber: '+1',
    tagLine: 'letter grade GPA',
    statement: 'Weekly planning is linked to a full letter-grade higher GPA on average.',
    citationLine1: 'Journal of American College Health',
    citationLine2: 'Bhat et al., 2021',
  },
  {
    id: 'retention-spacing',
    accentColor: '#6C8EBF', // muted blue
    topBadges: ['200%', 'retention'],
    bigNumber: '200%',
    statement:
      'Spaced repetition + active recall improve long-term retention by 200% versus cramming.',
    citationLine1: 'Psychology & Education Research',
    citationLine2: 'Shift Learning Meta-Analysis',
  },
  {
    id: 'stress-protection',
    accentColor: '#E38A7A', // muted coral
    topBadges: ['22%', 'lower stress'],
    bigNumber: '22%',
    tagLine: 'lower stress',
    statement: 'Planning tools cut stress by 22% and protect against a 25% drop in GPA',
    citationLine1: 'Applied Psychology: Health and Well-Being',
    citationLine2: 'Mansuroglu et al.',
  },
];

export type TruthCardsProps = {
  className?: string;
  eyebrow?: string;
  heading?: string;
  cards?: TruthCardModel[];
};

export default function TruthCards(props: TruthCardsProps): JSX.Element {
  const { className, cards = DEFAULT_CARDS } = props;

  const eyebrow = props.eyebrow ?? 'Why it matters';
  const heading = props.heading ?? 'Stop surviving, start thriving';

  return (
    <section className={`wg-truthcards ${className ?? ''}`} aria-labelledby="wg-truthcards-title">
      <div className="wg-truthcards-inner">
        <header className="wg-truthcards-header">
          <p className="wg-truthcards-eyebrow">{eyebrow}</p>
          <h2 id="wg-truthcards-title" className="wg-truthcards-title">
            {heading}
          </h2>
        </header>

        <div className="wg-truthcards-grid" role="list" aria-label="WiseGraph truth cards">
          {cards.map((card) => (
            <article
              key={card.id}
              className="wg-truthcard"
              role="listitem"
              style={
                {
                  '--wg-truthcard-accent': card.accentColor,
                } as React.CSSProperties
              }
            >
              {/* background texture layer lives in CSS (:before) */}
              <div className="wg-truthcard-content">
                <div className="wg-truthcard-top">
                  <div className="wg-truthcard-badges" aria-label="Key metric tags">
                    {card.topBadges.map((b) => (
                      <span key={b} className="wg-truthcard-badge">
                        {b}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="wg-truthcard-metric" aria-label="Primary metric">
                  <div className="wg-truthcard-big">{card.bigNumber}</div>
                  {card.tagLine ? <div className="wg-truthcard-tag">{card.tagLine}</div> : null}
                </div>

                <p className="wg-truthcard-statement">{card.statement}</p>

                <div className="wg-truthcard-citation" aria-label="Citation">
                  <span className="wg-truthcard-cite-line">{card.citationLine1}</span>
                  <span className="wg-truthcard-cite-line">{card.citationLine2}</span>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
