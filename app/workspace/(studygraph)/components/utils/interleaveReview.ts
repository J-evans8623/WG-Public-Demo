/**
 * @file interleaveReview.ts
 * @responsibilities
 *   - buildFlashCardDeck: constructs a deck of flash‑card RevisionCards by
 *     drawing from “wrong”, “new”, then “seen” buckets according to quotas,
 *     redistributing leftovers when buckets exhaust.
 *   - buildQuizQueues: constructs per‐type quiz queues by reusing buildFlashCardDeck,
 *     with safe fallback to default quotas if none are provided.
 *   - Provides DEFAULT_BUCKET_QUOTAS to guard against missing configuration.
 *   - Emits purposeful console.log statements for key checkpoints and fallback usage.
 */

import type {
  FlashCardStats,
  QuizItemStats,
  PriorityBuckets,
  BucketQuotas,
  QuizType,
  QuizQueue,
  RevisionCard,
  RevisionQueues,
} from '@/app/Library/Definitions/UserDataDefinitions';

// Default quotas applied when none are provided to prevent runtime errors.
const DEFAULT_BUCKET_QUOTAS: BucketQuotas = {
  newQuota: 0.3,
  wrongQuota: 0.4,
  seenQuota: 0.3,
};

/** Simple in‑place Fisher–Yates shuffle. */
function shuffle<T>(array: T[]): T[] {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

/**
 * Builds a deck of `deckSize` flash cards, returning fully-qualified `RevisionCard` triples.
 */
export function buildFlashCardDeck(
  statsMap: Record<string, FlashCardStats>,
  buckets: PriorityBuckets,
  quotas: BucketQuotas,
  allCards: RevisionCard[],
  deckSize: number = 20
): RevisionCard[] {
  console.log('[interleaveReview.ts][1001] › Starting flash‑card deck build');
  // 1) Prepare and shuffle lists
  const newList = shuffle([...buckets.newItems]);
  const wrongList = shuffle([...buckets.wrongItems]);
  const seenList = shuffle(
    allCards.filter(
      card =>
        !buckets.newItems.some(n => n.cardId === card.cardId) &&
        !buckets.wrongItems.some(n => n.cardId === card.cardId)
    )
  );

  // 2) Convert quotas to counts
  let newCount = Math.round(quotas.newQuota * deckSize);
  let wrongCount = Math.round(quotas.wrongQuota * deckSize);
  let seenCount = Math.round(quotas.seenQuota * deckSize);

  console.log(
    '[interleaveReview.ts][1002] › Quotas→counts',
    { newCount, wrongCount, seenCount, deckSize }
  );

  const deck: RevisionCard[] = [];

  // Helper to draw up to `count` from `list`, returns leftover count
  function draw(list: RevisionCard[], count: number): number {
    const take = Math.min(list.length, count);
    deck.push(...list.splice(0, take));
    return count - take;
  }

  // 3) Draw in priority order
  let left = draw(wrongList, wrongCount);
  if (left > 0) { newCount += left; wrongCount -= left; }

  left = draw(newList, newCount);
  if (left > 0) { seenCount += left; newCount -= left; }

  left = draw(seenList, seenCount);
  seenCount -= (seenCount - Math.max(0, left));

  // 4) Fill any remaining slots from all buckets
  const remaining = deckSize - deck.length;
  const pool = shuffle([...newList, ...wrongList, ...seenList]);
  deck.push(...pool.slice(0, remaining));

  console.log(
    '[interleaveReview.ts][1003] › Completed flash deck:',
    deck.length, 'cards'
  );
  return deck;
}

/**
 * Builds a quiz queue for each quiz type, returning RevisionCard triples per type.
 */
export function buildQuizQueues(
  statsMap: Record<string, QuizItemStats>,
  bucketsMap: Record<QuizType, PriorityBuckets>,
  quotasMap: Record<QuizType, BucketQuotas>,
  allCardsMap: Record<QuizType, RevisionCard[]>,
  lengthMap: Record<QuizType, number>
): QuizQueue {
  console.log('[interleaveReview.ts][2001] › Starting quiz queue build for types:', Object.keys(bucketsMap));

  const result = {} as QuizQueue;

  (Object.keys(bucketsMap) as QuizType[]).forEach(type => {
    // 1) Retrieve or fallback quotas
    const quotas = quotasMap[type] ?? DEFAULT_BUCKET_QUOTAS;
    if (!quotasMap[type]) {
      console.log(
        `[interleaveReview.ts][2002] › quotasMap["${type}"] undefined; using default:`,
        quotas
      );
    }

    // 2) Determine cards and desired length
    const cardsOfType = allCardsMap[type] || [];
    const desiredLength = lengthMap[type] ?? cardsOfType.length;
    console.log(
      `[interleaveReview.ts][2003] › Building "${type}" queue:`,
      { desiredLength, quotas }
    );

    // 3) Delegate to flash‑card deck builder
    result[type] = buildFlashCardDeck(
      {} as Record<string, FlashCardStats>,
      bucketsMap[type],
      quotas,
      cardsOfType,
      desiredLength
    );

    console.log(
      `[interleaveReview.ts][2004] › Completed "${type}" queue:`,
      result[type].length, 'cards'
    );
  });

  console.log('[interleaveReview.ts][1004] › Completed quiz queues');
  return result;
}
