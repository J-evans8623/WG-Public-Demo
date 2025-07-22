/***************************************************************************************
 * @file UserDataContext.tsx
 * @description
 *   React context for per‑user offline review data, scoped by document identifier.
 *   Implements:
 *     1. Fetch-or-bootstrap flow on mount.
 *     2. Initial ingestion of all flash‑cards & quizzes.
 *     3. Ongoing “sync” effect that diffs resources and updates newItems/wrongItems.
 *     4. Record handlers for flash‑card views & quiz attempts.
 *     5. Revision queue generation.
 *
 *   Everything is heavily commented so you can follow each step.
 ***************************************************************************************/

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  ReactNode,
  useRef,
} from 'react';
import type {
  RevisionMetaData,
  QuizType,
  FlashCardStats,
  QuizItemStats,
  RevisionQueues,
  RevisionCards,
  RevisionCard,
  Bookmark,
} from '@/app/Library/Definitions/UserDataDefinitions';
import {
  buildFlashCardDeck,
  buildQuizQueues,
} from '@/app/studygraph/(studygraph)/components/utils/interleaveReview';
import { useYDoc } from '@/app/Library/Context/YDocContext';
import { useSession } from 'next-auth/react';
import { useResourceScanner } from '@/app/studygraph/(studygraph)/components/hooks/resourceScanner';
import { CueCardResource, PracticeSheetResource } from '../Definitions/Definitions';
import { useResourceContext } from './ResourceContext';
import type { ResourceCard } from '@/app/Library/Definitions/Definitions';

interface UserDataContextValue {
  userRevisionData: RevisionMetaData | null;
  loading: boolean;
  recordQuizAttempt: (itemId: string, quizType: QuizType, correct: boolean) => void;
  generateRevision: () => RevisionCards | null;
  LoadUserData: (docId:string) => Promise<RevisionMetaData | null>;
  InitializeUserData: (documentID:string) => Promise<RevisionMetaData>;
  SaveUserData: (docId:string) => Promise<void>;
  recordQuizSession : () => void;
  // bookmark controls
  addBookmark: (b: Bookmark) => void;
  removeBookmark: (resourceId: string) => void;
  toggleBookmark: (b: Bookmark) => void;
  isBookmarked: (resourceId: string) => boolean;
   getBookmarkSlidesForLesson: (lessonId: string) => ResourceCard[];
}

const UserDataContext = createContext<UserDataContextValue | undefined>(
  undefined
);

export const UserDataProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  // ───────────────────── Hooks & Context ─────────────────────
  const { data: session } = useSession();
  const userId = session?.user.name;
  const { docFileID } = useYDoc();
  const { getAllFlashCards, getAllQuizzes } = useResourceScanner();
  const { getGlobalResourceCard, updatedRivisonCard, setupdatedRivisionCard } = useResourceContext();

  // ───────────────────── Local State ────────────────────────
  const [userRevisionData, setuserRevisionData] = useState<RevisionMetaData | null>(null);
  const [loading, setLoading] = useState(true);
 

  // ─────────────────────── Helpers ────────────────────────

  // 3) SAVE user data back to server (PUT)
const SaveUserData = useCallback(
  async ( docId:string): Promise<void> => {
    if (!docFileID) return;
    const url = `/api/userData?docId=${encodeURIComponent(docId)}`;
    await fetch(url, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userRevisionData),
    });
  },
  [docFileID, userRevisionData]
);

  //_________________save user data after time debounce and resource context change

    // ───  Debounce timer state ──────────────────────────────────
  const SAVE_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
  const [timerDebounceExpired, setTimerDebounceExpired] = useState(true);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const resetTimerDebouncer = useCallback(() => {
    setTimerDebounceExpired(false);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setTimerDebounceExpired(true);
    }, SAVE_INTERVAL_MS);
  }, [SAVE_INTERVAL_MS]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  useEffect(()=>{
    if (updatedRivisonCard && timerDebounceExpired && docFileID) {
      SaveUserData(docFileID)
      setupdatedRivisionCard(false)
      resetTimerDebouncer();
    }
  }, [SaveUserData, docFileID, resetTimerDebouncer, setupdatedRivisionCard, timerDebounceExpired, updatedRivisonCard]);
  

  // ───────────── Generate Revision Queues ────────────────────

/**
   * @function generateRevision
   * @description
   *   Computes a revision session by first interleaving triples for flash cards and quizzes
   *   according to the user’s spaced‑repetition configuration. It then resolves each triple
   *   to a fully‑formed ResourceCard by calling getGlobalResourceCard with the stored
   *   mapId, nodeId, and cardId. The result is a RevisionCards object containing arrays
   *   of CueCardResource and PracticeSheetResource, ready for consumption by UI components.
   *   Console logs at key checkpoints expose flow and missing lookups for debugging.
   */
  const generateRevision = useCallback((): RevisionCards | null => {
    console.log('[UserDataContext.tsx][2001] › generateRevision invoked');
    if (!userRevisionData) {
      console.log('[UserDataContext.tsx][2002] › No userData; returning null');
      return null;
    }   



    // --- 1.a) Grab the full universe of cards from the scanner ---
  const allFlashCards: RevisionCard[] = getAllFlashCards().map(c => ({
    mapId:  c.mapId,
    nodeId: c.nodeId,
    cardId: c.id,
  }));

    const QUIZ_TYPES: QuizType[] = ['matching','multipleChoice','true-false','FIB'];
  const allQuizCardsByType: Record<QuizType, RevisionCard[]> = {
    matching: [], multipleChoice: [], 'true-false': [], FIB: []
  };
  for (const r of getAllQuizzes()) {
    if (r.type === 'practiceSheet') {
      const ps = r as PracticeSheetResource;
      allQuizCardsByType[ps.content.quizType].push({
        mapId:  ps.mapId,
        nodeId: ps.nodeId,
        cardId: ps.id,
      });
    }
  }

    // 1) Build interleaved triple queues
    const fcRevisionCards: RevisionCard[] = buildFlashCardDeck(
      userRevisionData.flashCardStats,
      userRevisionData.priority.flashCards,
      userRevisionData.queues.config.flashCardQuotas,
      allFlashCards,
    );
    const qLens: Record<QuizType, number> = {
      matching: 5,
      multipleChoice: 5,
      'true-false': 5,
      FIB: 5,
    };

    const quizRevisionCards = buildQuizQueues(
      userRevisionData.quizStats,
      userRevisionData.priority.quizzes,
      userRevisionData.queues.config.quizQuotas,
      allQuizCardsByType,
      qLens
    );

    // 2) Resolve flash‑card triples → CueCardResource[]
    const flashCards: CueCardResource[] = fcRevisionCards
      .map(({ mapId, nodeId, cardId }) => {
        const card = getGlobalResourceCard(mapId, nodeId, cardId) as CueCardResource | undefined;
        if (!card) {
          console.warn(
            '[UserDataContext.tsx][2003] › Missing flashCard resource for',
            { mapId, nodeId, cardId }
          );
        }
        return card;
      })
      .filter((c): c is CueCardResource => !!c);

    // 3) Resolve quiz triples → PracticeSheetResource[]
    const quizzes: PracticeSheetResource[] = [];
    (Object.keys(quizRevisionCards) as QuizType[]).forEach(type => {
      quizRevisionCards[type].forEach(({ mapId, nodeId, cardId }) => {
        const card = getGlobalResourceCard(mapId, nodeId, cardId) as PracticeSheetResource | undefined;
        if (card) {
          quizzes.push(card);
        } else {
          console.warn(
            '[UserDataContext.tsx][2004] › Missing quiz resource for',
            { mapId, nodeId, cardId }
          );
        }
      });
    });

    console.log(
      '[UserDataContext.tsx][2005] › generateRevision assembled',
      flashCards.length, 'flashCards and',
      quizzes.length, 'quizzes'
    );
    return { flashCards, quizzes };
  }, [userRevisionData, getAllFlashCards, getAllQuizzes, getGlobalResourceCard]);

  // ───────────── Context Value & Render ─────────────────────


// 1) LOAD existing user data (GET)
const LoadUserData = useCallback(
  async (docId:string): Promise<RevisionMetaData | null> => {
    if (!userId || !docId) return null;
    const resp = await fetch(
      `/api/userData?docId=${encodeURIComponent(docId)}`,
      { credentials: 'include' }
    );
    if (resp.status === 404) {
      return null;
    }
    if (!resp.ok) {
      throw new Error(`LoadUserData GET failed: ${resp.status}`);
    }
    const data = (await resp.json()) as RevisionMetaData;
    data.GlobalQuizAttempts = data.GlobalQuizAttempts ?? 0;
    // ←── SET CONTEXT STATE HERE
    data.bookmarks = data.bookmarks ?? [];
    setuserRevisionData(data);
    setLoading(false);
    return data;
  },
  [userId]
);

// 2) INITIALIZE brand‑new user data (bootstrap)
async function InitializeUserData(documentID:string): Promise<RevisionMetaData> {
  const initial: RevisionMetaData = {
    userId: userId!,
    quizStats: {},
    flashCardStats: {},
    priority: {
      flashCards: { newItems: [], wrongItems: [] },
      quizzes: {
        matching: { newItems: [], wrongItems: [] },
        multipleChoice: { newItems: [], wrongItems: [] },
        'true-false': { newItems: [], wrongItems: [] },
        FIB: { newItems: [], wrongItems: [] },
      },
    },
    queues: {
      config: {
        flashCardQuotas: { newQuota: 0.3, wrongQuota: 0.4, seenQuota: 0.3 },
        quizQuotas: {
          matching:   { newQuota: 0.25, wrongQuota: 0.25, seenQuota: 0.5 },
          multipleChoice: { newQuota: 0.25, wrongQuota: 0.25, seenQuota: 0.5 },
          'true-false':   { newQuota: 0.25, wrongQuota: 0.25, seenQuota: 0.5 },
          FIB:            { newQuota: 0.25, wrongQuota: 0.25, seenQuota: 0.5 },
        },
      },
      current: {
        flashCardQueue: [],
        quizQueue: {
          matching: [], multipleChoice: [], 'true-false': [], FIB: []
        },
      },
    },
    GlobalQuizAttempts:0,
     bookmarks: [],
  };

  // save and return
  await fetch(`/api/userData?docId=${encodeURIComponent(documentID)}`, {
    method: 'PUT',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(initial),
  });

  setuserRevisionData(initial);
  setLoading(false);

  return initial;
}

// Updates a single quiz stat
const updateQuizQuestionStat = useCallback(
  (
    itemId: string,
    quizType: QuizType,
    correct: boolean
  ) => {
    if (!userRevisionData) return;

    // 1) Compute “before” global average
    const statsArr = Object.values(userRevisionData.quizStats).filter(s => s.totalAttempts > 0);
        // 2) Compute “before” per‑lesson averages
    const statsByLesson: Record<string, { attempted: number; correct: number }> = {};
    statsArr.forEach(s => {
      const resource = getAllQuizzes().find(q => q.id === s.itemId);
      if (!resource) return;
      const mid = resource.mapId;
      if (!statsByLesson[mid]) statsByLesson[mid] = { attempted: 0, correct: 0 };
      statsByLesson[mid].attempted += s.totalAttempts;
      statsByLesson[mid].correct += s.totalAttempts - s.incorrectAttempts;
    });
    const prevLessonAverages: Record<string, number> = {};
    Object.entries(statsByLesson).forEach(([mid, { attempted, correct }]) => {
      prevLessonAverages[mid] = attempted > 0
        ? Math.round((correct / attempted) * 100)
        : 0;
    });

    // ─── 3) Correctly find the sheet that contains this question ───
    const now = Date.now();
    const existing = userRevisionData.quizStats[itemId];
    // Find the sheet whose quizContent array includes this question ID:
    const sheet = getAllQuizzes().find(
      ps => ps.type === 'practiceSheet'
         && ps.content.quizContent.some(q => q.id === itemId)
    ) as PracticeSheetResource | undefined;
    const mapId = sheet?.mapId ?? existing?.mapId ?? '';

    const oldStats: QuizItemStats = existing || {
      itemId, quizType, mapId, totalAttempts: 0, incorrectAttempts: 0, lastAttempted: now,
    };

    // ─── 4) Build the new stats ───
    const newStats: QuizItemStats = {
      ...oldStats,
      totalAttempts:     oldStats.totalAttempts + 1,
      incorrectAttempts: oldStats.incorrectAttempts + (correct ? 0 : 1),
      lastAttempted:     now,
    };

    // ─── 5) Single state update ───
setuserRevisionData(prev => {
  if (!prev) return prev;
  return {
    ...prev,
    quizStats: {
      ...prev.quizStats,
      [itemId]: newStats,
    },
  };
});
    setupdatedRivisionCard(true);
  },
  [userRevisionData, getAllQuizzes, setupdatedRivisionCard]
);

const recordQuizSession = useCallback(() => {
  if (!userRevisionData) return;
  // 1️⃣ Take a snapshot of current stats
  const statsArr = Object.values(userRevisionData.quizStats).filter(s => s.totalAttempts > 0);
  const totalAttempts = statsArr.reduce((sum, s) => sum + s.totalAttempts, 0);
  const totalCorrect  = statsArr.reduce((sum, s) => sum + (s.totalAttempts - s.incorrectAttempts), 0);
  const prevGlobalAverage = totalAttempts > 0
    ? Math.round((totalCorrect / totalAttempts) * 100)
    : 0;

  const statsByLesson: Record<string,{attempted:number,correct:number}> = {};
  statsArr.forEach(s => {
    statsByLesson[s.mapId] ??= {attempted:0, correct:0};
    statsByLesson[s.mapId].attempted += s.totalAttempts;
    statsByLesson[s.mapId].correct   += s.totalAttempts - s.incorrectAttempts;
  });
  const prevLessonAverages: Record<string, number> = {};
  Object.entries(statsByLesson).forEach(([mid,{attempted,correct}]) => {
    prevLessonAverages[mid] = attempted > 0
      ? Math.round((correct / attempted)*100)
      : 0;
  });

  // 2️⃣ Now update state once for the whole session
  setuserRevisionData(prev => ({
    ...prev!,
    GlobalQuizAttempts: (prev!.GlobalQuizAttempts ?? 0) + 1,
    previousGlobalAverage:   prevGlobalAverage,
    previousLessonAverages:  prevLessonAverages,
  }));
  setupdatedRivisionCard(true);
}, [userRevisionData, setupdatedRivisionCard]);


// ── NEW: Bookmark control methods ────────────────────────────────────────

  /**
   * @function addBookmark
   * @description
   *   Adds a new Bookmark record if it does not already exist, updating state
   *   and triggering a save. Prevents duplicates by resourceId.
   */
  const addBookmark = useCallback((b: Bookmark) => {
    console.log('[UserDataContext.tsx][9007] › addBookmark called', b);
    setuserRevisionData(prev => {
      if (!prev || prev.bookmarks.some(x => x.resourceId === b.resourceId)) return prev;
      const next = { ...prev, bookmarks: [...prev.bookmarks, b] };
      setupdatedRivisionCard(true);
      console.log('[UserDataContext.tsx][9008] › Bookmark added, total now', next.bookmarks.length);
      return next;
    });
  }, [setuserRevisionData, setupdatedRivisionCard]);

  /**
   * @function removeBookmark
   * @description
   *   Removes any existing Bookmark by resourceId, updating state and triggering a save.
   */
  const removeBookmark = useCallback((resourceId: string) => {
    console.log('[UserDataContext.tsx][9009] › removeBookmark called', resourceId);
    setuserRevisionData(prev => {
      if (!prev) return prev;
      const nextList = prev.bookmarks.filter(x => x.resourceId !== resourceId);
      const next = { ...prev, bookmarks: nextList };
      setupdatedRivisionCard(true);
      console.log('[UserDataContext.tsx][9010] › Bookmark removed, total now', next.bookmarks.length);
      return next;
    });
  }, [setuserRevisionData, setupdatedRivisionCard]);

  /**
   * @function toggleBookmark
   * @description
   *   Toggles the presence of a Bookmark: removes it if present, adds it otherwise.
   */
  const toggleBookmark = useCallback((b: Bookmark) => {
    console.log('[UserDataContext.tsx][9011] › toggleBookmark called', b.resourceId);
    if (userRevisionData?.bookmarks.some(x => x.resourceId === b.resourceId)) {
      removeBookmark(b.resourceId);
    } else {
      addBookmark(b);
    }
  }, [addBookmark, removeBookmark, userRevisionData]);

  /**
   * @function isBookmarked
   * @description
   *   Returns whether the given resourceId is currently bookmarked.
   */
  const isBookmarked = useCallback((resourceId: string): boolean => {
    const result = userRevisionData?.bookmarks.some(x => x.resourceId === resourceId) ?? false;
    console.log('[UserDataContext.tsx][9012] › isBookmarked(', resourceId, ') →', result);
    return result;
  }, [userRevisionData]);


  /**
   * @function getBookmarkSlidesForLesson
   * @description
   *   Collects and returns an array of fully‑formed ResourceCard objects
   *   for every bookmark in the specified lesson. Uses getGlobalResourceCard
   *   to materialize each bookmark’s resource. Perfect for passing directly
   *   into SlideShowContext.openCustom.
   */
  const getBookmarkSlidesForLesson = useCallback((lessonId: string): ResourceCard[] => {
    console.log('[UserDataContext.tsx][9020] › getBookmarkSlidesForLesson called with', lessonId);
    if (!userRevisionData) return [];
    const slides = userRevisionData.bookmarks
      .filter(b => b.mapId === lessonId)
      .map(b => getGlobalResourceCard(b.mapId, b.nodeId, b.resourceId))
      .filter((c): c is ResourceCard => Boolean(c));
    console.log('[UserDataContext.tsx][9021] › returning slides count', slides.length);
    return slides;
  }, [userRevisionData, getGlobalResourceCard]);


  return (
    <UserDataContext.Provider
      value={{
        userRevisionData,
        loading,
        recordQuizAttempt : updateQuizQuestionStat,
        generateRevision,
        LoadUserData,
        InitializeUserData,
        SaveUserData,
        recordQuizSession,
        addBookmark,
      removeBookmark,
      toggleBookmark,
      isBookmarked,
      getBookmarkSlidesForLesson
      }}
    >
      {children}
    </UserDataContext.Provider>
  );
};

export function useUserData(): UserDataContextValue {
  const ctx = useContext(UserDataContext);
  if (!ctx) {
    throw new Error('useUserData must be used within UserDataProvider');
  }
  return ctx;
}
