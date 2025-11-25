// File: app/workspace/(studygraph)/components/layout/Bookmark/BookmarkModal.tsx
/***************************************************************************************
 * @file BookmarkModal.tsx
 * @description
 *   This file declares the BookmarkModal component responsible for rendering
 *   an accessible modal dialog that lists and groups user‑defined bookmarks by lesson.
 *   It integrates with UserDataContext to fetch each lesson’s bookmarks, uses
 *   ResourceContext to look up full ResourceCard details, and leverages
 *   SlideShowContext to present selected bookmarks in the SlideshowOverlay.
 *   Each lesson’s section is an accordion that, when a bookmark is clicked,
 *   opens the slideshow view starting at the chosen bookmark and including
 *   all other bookmarks for that lesson. Focus trapping, keyboard navigation,
 *   and portal rendering are provided by Headless UI’s Dialog framework.
 *   Console logs mark navigation and opening events to aid debugging and observability.
 ***************************************************************************************/
import React, { useEffect } from 'react';
import ReactDOM from 'react-dom';
import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from '@headlessui/react';
import { useUserData } from '@/app/Library/Context/UserDataContext';
import { useLessonModule } from '@/app/Library/Context/LessonModuleContext';
import { useSlideShow } from '@/app/Library/Context/SlideShowContext'; // ← NEW


interface BookmarkModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const BookmarkModal: React.FC<BookmarkModalProps> = ({ isOpen, onClose }) => {
  const { getBookmarkSlidesForLesson } = useUserData();  // ← NEW
  const { openCustom } = useSlideShow();                 // ← NEW
  const lessons = useLessonModule().getLessonModule().conceptMaps;
 

  // 1) Escape‑to‑close hookup
  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        console.log('[BookmarkModal.tsx][3006] › Closing on Escape key');
        onClose();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return ReactDOM.createPortal(
    <Dialog open={isOpen} onClose={onClose} className="fixed inset-0 z-50">
      <DialogBackdrop className="fixed inset-0 bg-black/30" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel className="relative w-full max-w-xl bg-white rounded-lg p-6 shadow-lg overflow-auto max-h-[80vh]">
          <DialogTitle className="text-2xl font-semibold mb-4">
            Your Bookmarks
          </DialogTitle>

          {lessons.map((lesson) => {
            const bookmarks = getBookmarkSlidesForLesson(lesson.id);
            return (
              <details key={lesson.id} className="mb-3 border rounded">
                <summary className="px-4 py-2 bg-gray-100 cursor-pointer flex justify-between">
                  <span>{lesson.title}</span>
                  <span className="font-medium">{bookmarks.length}</span>
                </summary>
                {bookmarks.length > 0 && (
                  <ul className="pl-6 pr-4 py-2 space-y-2">
                    {bookmarks.map((card) => (
                      <li
                        key={card.id}
                        className="flex justify-between items-center py-1 hover:bg-gray-50 px-2 rounded cursor-pointer"
                        onClick={() => {
                          console.log(
                            '[BookmarkModal.tsx][4001] › Opening slides for lesson',
                            lesson.id,
                            'start with',
                            card.id
                          );
                          // 1) Fetch all slides for this lesson
                          const allSlides = getBookmarkSlidesForLesson(lesson.id);
                          // 2) Prioritize the clicked card
                          const selected = allSlides.find(c => c.id === card.id);
                          const others   = allSlides.filter(c => c.id !== card.id);
                          const slidesToShow = selected ? [selected, ...others] : allSlides;
                          const resumeSlide = false
                          // 3) Open the slideshow & close modal
                          openCustom(slidesToShow, undefined, resumeSlide);
                          onClose();
                        }}
                      >
                        <span className="truncate">{card.title}</span>
                        <span className="text-sm text-gray-500">{card.type}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </details>
            );
          })}

          <div className="text-right mt-4">
            <button
              onClick={() => {
                console.log('[BookmarkModal.tsx][3008] › Close clicked');
                onClose();
              }}
              className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300 transition"
            >
              Close
            </button>
          </div>
        </DialogPanel>
      </div>
    </Dialog>,
    document.body
  );
};

export default BookmarkModal;
