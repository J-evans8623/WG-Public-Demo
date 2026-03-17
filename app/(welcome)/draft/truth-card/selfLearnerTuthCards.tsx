'use client';

/**
 * @file app\(welcome)\draft\truth-card\selfLearnerTuthCards.tsx
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
    id: 'micro-lessons',
    accentColor: '#5B8C5A', // sage
    topBadges: ['80%', 'consistency'],
    bigNumber: '80%',
    statement: 'Breaking books into micro-lessons increases completion rates from 20% to over 80%.',
    citationLine1: 'Journal of Applied Psychology',
    citationLine2: 'Engageli 2025 Meta-Analysis',
  },
  {
    id: 'retention-spacing',
    accentColor: '#6C8EBF', // muted blue
    topBadges: ['200%', 'retention'],
    bigNumber: '200%',
    statement:
      'Spaced repetition + active recall improve long-term retention by 200%',
    citationLine1: 'Psychology & Education Research',
    citationLine2: 'Shift Learning Meta-Analysis',
  },
  {
    id: 'stress-protection',
    accentColor: '#E38A7A', // muted coral
    topBadges: ['85%', 'growth mindset'],
    bigNumber: '85%',
    statement: '85% of self-made millionaires read two or more books per month for growth',
    citationLine1: 'Wealth Habit Research',
    citationLine2: 'Thomas Corley, Author',
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

  const eyebrow = props.eyebrow ?? 'Why this habit is worth building';
  const heading = props.heading ?? 'Small steps. Lasting change.';

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
