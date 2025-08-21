/**
 * @file pages/api/calendar/persist.ts
 * @description
 *   Enhanced API endpoint for persisting and retrieving comprehensive user calendar data including selected notebooks,
 *   enhanced schedule configurations with multi-subject support, monthly calendar structures with daily study plans,
 *   and session completion tracking. This endpoint handles GET, PUT, and DELETE operations for complete calendar
 *   data management while ensuring proper user authentication and comprehensive data validation. The implementation
 *   integrates with Firebase storage functions to provide reliable persistence across browser sessions and devices
 *   with support for complex nested structures including CalendarMonth, DailyStudyPlan, and enhanced ScheduleConfig.
 *   All calendar data is user-scoped and includes robust error handling, input validation, and response formatting
 *   with proper serialization of Date objects and nested calendar structures. The endpoint supports the new calendar
 *   system's requirements for 30/31 day monthly views, multi-subject daily planning, and session completion tracking
 *   while maintaining backward compatibility and providing comprehensive fallback mechanisms for data integrity.
 *
 * Responsibilities:
 *   - Authenticate user requests through NextAuth session validation
 *   - Handle GET requests for loading complete calendar data with monthly structures
 *   - Handle PUT requests for saving enhanced calendar data with complex nested objects
 *   - Validate enhanced calendar data structure including CalendarMonth and ScheduleConfig
 *   - Serialize and deserialize complex calendar structures with proper Date handling
 *   - Integrate with enhanced Firebase calendar storage functions
 *   - Support session completion tracking and monthly calendar persistence
 *   - Provide proper error handling and comprehensive user feedback
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { 
  storeCalendarData, 
  loadCalendarData, 
  clearCalendarData,
  updateCalendarData 
} from '@/app/src/services/firebase';
import { authenticateRequest } from '@/app/src/auth/authenticateRequest';
import { CalendarData, CalendarMonth, DailyStudyPlan, ScheduleConfig } from '@/app/Library/Definitions/CalendarDefinitions';

/**
 * Main API handler for calendar persistence operations supporting enhanced calendar structures.
 * Processes GET, PUT, and DELETE requests with comprehensive validation and error handling
 * for the new monthly calendar system with multi-subject daily planning capabilities.
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  console.log('[persist.ts][3001] › Enhanced calendar persist request:', req.method);

  // Step 1: Authenticate user session with comprehensive error handling
  const session = await authenticateRequest(req, res);
  if (!session) {
    console.log('[persist.ts][3002] › Authentication failed for calendar request');
    return;
  }

  const userId = session.user.email!;

  try {
    if (req.method === 'GET') {
      // Step 2: Handle enhanced calendar data retrieval with monthly structures
      console.log('[persist.ts][3003] › Loading enhanced calendar data for user:', userId);
      
      const calendarData = await loadCalendarData(userId);
      
      if (!calendarData) {
        console.log('[persist.ts][3004] › No calendar data found, returning enhanced defaults');
        
        // Step 3: Return enhanced default configuration with new fields
        const defaultResponse = {
          selectedNotebooks: [],
          scheduleConfig: {
            unitsPerBlockSession: 3,
            revisionsPerLesson: 2,
            startDate: new Date().toISOString(),
            daysPerWeek: [1, 2, 3, 4, 5],
            subjectsPerDay: 3,
            preferredTimeSlots: ['morning', 'afternoon', 'evening'],
            maxSessionsPerDay: 6,
          },
          currentMonth: null,
          completedSessions: [],
          lastUpdated: new Date().toISOString(),
          version: '2.0',
        };
        
        return res.status(200).json(defaultResponse);
      }
      
      // Step 4: Format enhanced response with proper date serialization
      const response = {
        selectedNotebooks: calendarData.selectedNotebooks,
        scheduleConfig: {
          ...calendarData.scheduleConfig,
          startDate: calendarData.scheduleConfig.startDate.toISOString(),
        },
        currentMonth: calendarData.currentMonth ? {
          year: calendarData.currentMonth.year,
          month: calendarData.currentMonth.month,
          dailyPlans: calendarData.currentMonth.dailyPlans.map(plan => ({
            ...plan,
            date: plan.date.toISOString(),
            sessions: plan.sessions.map(session => ({
              ...session,
              date: session.date.toISOString(),
              notebookMeta: {
                ...session.notebookMeta,
                lastUpdated: session.notebookMeta.lastUpdated.toISOString(),
              },
            })),
          })),
          monthlySummary: calendarData.currentMonth.monthlySummary,
        } : null,
        completedSessions: calendarData.completedSessions,
        lastUpdated: calendarData.lastUpdated.toISOString(),
        version: calendarData.version,
      };
      
      console.log('[persist.ts][3005] › Enhanced calendar data loaded successfully with monthly structure');
      return res.status(200).json(response);
      
    } else if (req.method === 'PUT') {
      // Step 5: Handle enhanced calendar data storage with complex structures
      console.log('[persist.ts][3006] › Storing enhanced calendar data for user:', userId);
      
      const calendarData = req.body;
      
      // Step 6: Validate enhanced calendar data structure
      if (!calendarData || typeof calendarData !== 'object') {
        console.log('[persist.ts][3007] › Invalid enhanced calendar data provided');
        return res.status(400).json({ error: 'Invalid calendar data structure' });
      }
      
      // Step 7: Validate and deserialize enhanced calendar structures with comprehensive error handling
      const processedData: CalendarData = {
        selectedNotebooks: Array.isArray(calendarData.selectedNotebooks) 
          ? calendarData.selectedNotebooks 
          : [],
        scheduleConfig: {
          unitsPerBlockSession: Math.max(1, calendarData.scheduleConfig?.unitsPerBlockSession || 3),
          revisionsPerLesson: Math.max(0, calendarData.scheduleConfig?.revisionsPerLesson || 2),
          startDate: new Date(calendarData.scheduleConfig?.startDate || Date.now()),
          daysPerWeek: Array.isArray(calendarData.scheduleConfig?.daysPerWeek) 
            ? calendarData.scheduleConfig.daysPerWeek 
            : [1, 2, 3, 4, 5],
          // Step 8: Handle enhanced configuration fields with validation
          subjectsPerDay: Math.max(1, calendarData.scheduleConfig?.subjectsPerDay || 3),
          preferredTimeSlots: Array.isArray(calendarData.scheduleConfig?.preferredTimeSlots)
            ? calendarData.scheduleConfig.preferredTimeSlots
            : ['morning', 'afternoon', 'evening'],
          maxSessionsPerDay: Math.max(1, calendarData.scheduleConfig?.maxSessionsPerDay || 6),
        },
        // Step 9: Handle CalendarMonth structure with nested DailyStudyPlan deserialization
        currentMonth: calendarData.currentMonth ? {
          year: calendarData.currentMonth.year || new Date().getFullYear(),
          month: calendarData.currentMonth.month !== undefined 
            ? calendarData.currentMonth.month 
            : new Date().getMonth(),
          dailyPlans: Array.isArray(calendarData.currentMonth.dailyPlans) 
            ? calendarData.currentMonth.dailyPlans.map((plan: any) => ({
                date: new Date(plan.date),
                sessions: Array.isArray(plan.sessions) ? plan.sessions.map((session: any) => ({
                  ...session,
                  date: new Date(session.date),
                  notebookMeta: {
                    ...session.notebookMeta,
                    lastUpdated: new Date(session.notebookMeta.lastUpdated),
                    color: session.notebookMeta.color || undefined,
                  },
                  timeSlot: session.timeSlot || undefined,
                })) : [],
                subjectSummary: plan.subjectSummary || {},
                totalDuration: plan.totalDuration || 0,
                completedSessions: Array.isArray(plan.completedSessions) 
                  ? plan.completedSessions 
                  : [],
              }))
            : [],
          monthlySummary: {
            totalSessions: calendarData.currentMonth.monthlySummary?.totalSessions || 0,
            totalStudyTime: calendarData.currentMonth.monthlySummary?.totalStudyTime || 0,
            activeNotebooks: Array.isArray(calendarData.currentMonth.monthlySummary?.activeNotebooks)
              ? calendarData.currentMonth.monthlySummary.activeNotebooks
              : [],
            completionRate: calendarData.currentMonth.monthlySummary?.completionRate || 0,
          },
        } : null,
        // Step 10: Handle session completion tracking
        completedSessions: Array.isArray(calendarData.completedSessions)
          ? calendarData.completedSessions
          : [],
        lastUpdated: new Date(),
        version: calendarData.version || '2.0',
      };
      
      // Step 11: Store enhanced calendar data with comprehensive structure
      await storeCalendarData(userId, processedData);
      
      console.log('[persist.ts][3008] › Enhanced calendar data stored successfully with monthly structure');
      return res.status(200).json({ success: true });
      
    } else if (req.method === 'DELETE') {
      // Step 12: Handle enhanced calendar data clearing
      console.log('[persist.ts][3009] › Clearing enhanced calendar data for user:', userId);
      
      await clearCalendarData(userId);
      
      console.log('[persist.ts][3010] › Enhanced calendar data cleared successfully');
      return res.status(200).json({ success: true });
      
    } else {
      // Step 13: Handle unsupported methods with proper response headers
      res.setHeader('Allow', ['GET', 'PUT', 'DELETE']);
      console.log('[persist.ts][3011] › Unsupported method attempted:', req.method);
      return res.status(405).json({ error: 'Method Not Allowed' });
    }
    
  } catch (error) {
    console.error('[persist.ts][3012] › Error handling enhanced calendar persist request:', error);
    return res.status(500).json({ 
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
}