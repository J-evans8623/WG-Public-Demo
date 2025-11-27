'use client';

import React from 'react';
import './features-page.css';
import Image from 'next/image';

// Icons (Inline SVG)
const Icons = {
  Notebook: () => (<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>),
  Map: () => (<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M3 12h3"></path><path d="M18 12h3"></path><path d="M12 3v3"></path><path d="M12 18v3"></path><path d="M19.07 4.93 17 7"></path><path d="M7 17l-2.07 2.07"></path><path d="M19.07 19.07 17 17"></path><path d="M7 7l-2.07-2.07"></path></svg>),
  Upload: () => (<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>),
  Edit: () => (<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>),
  Calendar: () => (<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>),
  Bookmark: () => (<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"></path></svg>),
  Brain: () => (<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z"></path><path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2Z"></path></svg>),
  Quiz: () => (<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path><polyline points="14 2 14 8 20 8"></polyline><path d="m9 15 2 2 4-4"></path></svg>),
  Educator: () => (<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path></svg>)
};

const GettingStartedContent = () => {
  return (
    <div className="wg-feature-page">
      <div className="wg-container">
        
        {/* HERO */}
        <section className="wg-feature-hero">
          <span className="wg-hero-eyebrow">End the Cycle of Cramming</span>
          <h1 className="wg-feature-title">Get started with WiseGraph</h1>
          <p className="wg-feature-lead">
            WiseGraph turns your PDFs, slides, and documents into concept-map-based 
            micro lessons so you can study in focused, five-minute blocks.
          </p>
          <div className="wg-hero-note">
            Features available to all account types (Scholar & Educator)
          </div>
        </section>

        {/* 1. CREATE NOTEBOOK (Dual Screenshots) */}
        <div className="wg-feature-section wg-zigzag-row">
          <div className="wg-zigzag-content">
            <div className="wg-tan-card">
              <div className="wg-card-icon"><Icons.Notebook /></div>
              <h2 className="wg-card-title">Create your first notebook and lesson</h2>
              <div className="wg-card-body">
                <p>Start by creating a home for your course or subject.</p>
                <ul className="wg-card-list">
                  <li>On the welcome screen, select <strong>New notebook</strong>.</li>
                  <li>In your notebook, choose <strong>Generate lesson</strong> from the navigation panel.</li>
                  <li>Upload a PDF, PPTX, or DOCX file (Max 50MB / 100 pages).</li>
                </ul>
              </div>
              <div className="wg-tip-box">
                <span className="wg-tip-label">Quick Tip</span>
                <p className="wg-tip-text">Upload one chapter per lesson to keep your concept maps clear.</p>
              </div>
            </div>
          </div>
          <div className="wg-zigzag-visual">
            <div className="wg-app-frame">
              {/* BACKGROUND: Notebook Stage */}
              <Image src="/textures/notebook-stage.jpg" className="wg-frame-bg" alt="" aria-hidden="true"  width={1920} height={1080} style={{ width: '100%', height: 'auto', }} />

             
              {/* DUAL SCREENSHOTS */}
              <div className="wg-screenshots dual">
                <Image src="/get-started/create-notebook.png" className="wg-shot-img" alt="Create notebook modal"  width={1920} height={1080} style={{ width: '100%', height: 'auto', }}/>
                <Image src="/get-started/generate-lesson-menu-item.png" className="wg-shot-img" alt="Upload screen"  width={1920} height={1080} style={{ width: '100%', height: 'auto', }} />
              </div>
            </div>
          </div>
        </div>

        {/* 2. EXPLORE MAP (Single Screenshot) */}
        <div className="wg-feature-section wg-zigzag-row reverse">
          <div className="wg-zigzag-content">
            <div className="wg-tan-card">
              <div className="wg-card-icon"><Icons.Map /></div>
              <h2 className="wg-card-title">Explore your concept map</h2>
              <div className="wg-card-body">
                <p>Each node in the concept map is a five-minute micro lesson including a summary, flashcards, and a quiz.</p>
                <ul className="wg-card-list">
                  <li><strong>Blue nodes:</strong> Primary topics representing main ideas.</li>
                  <li><strong>Nested nodes:</strong> Subtopics depending on complexity.</li>
                </ul>
              </div>
                <div className="wg-tip-box">
                <span className="wg-tip-label">Quick Tip</span>
                <p className="wg-tip-text">Use blue nodes as your “anchor” topics.</p>
            <p className="wg-tip-text">Drill into nested nodes when you’re ready for more detail. </p>
            <p className="wg-tip-text"> Revisit the Uploads tab whenever you want to cross-check the original material. </p>
              </div>
            </div>
          </div>
          <div className="wg-zigzag-visual">
            <div className="wg-app-frame"> 
              {/* BACKGROUND: Blue Node Texture */}
              <Image src="/textures/blue-node-texture.jpg" className="wg-frame-bg" alt="" aria-hidden="true"  width={1920} height={1080} style={{ width: '100%', height: 'auto', }} />
              {/* SINGLE SCREENSHOT */}
              <div className="wg-screenshots single">
                <Image src="/get-started/hero-shot-2.png" className="wg-shot-img" alt="Concept map view"  width={1920} height={1080} style={{ width: '100%', height: 'auto', }}/>
              </div>
            </div>
          </div>
        </div>

        {/* 3. ADD MORE LESSONS (Single Screenshot) */} 
        <div className="wg-feature-section wg-zigzag-row">
          <div className="wg-zigzag-content">
            <div className="wg-tan-card">
              <div className="wg-card-icon"><Icons.Upload /></div>
              <h2 className="wg-card-title">Add more lessons to your notebook</h2>
              <div className="wg-card-body">
                <p>You can keep expanding a notebook as you study a course over time. Whenever you’re ready, select <strong>Generate lesson</strong> again.</p>
                <p>New concept maps will be added to the same notebook so you can build a rich, connected study hub.</p>
              </div>
            </div>
          </div>
          <div className="wg-zigzag-visual">
            <div className="wg-app-frame">
              {/* BACKGROUND: Notebook Stage (Reused) */}
              <Image src="/textures/notebook-stage.jpg" className="wg-frame-bg" alt="" aria-hidden="true"   width={1920} height={1080} style={{ width: '100%', height: 'auto', }}/>
              {/* SINGLE SCREENSHOT */}
              <div className="wg-screenshots single">
                <Image src="/get-started/add-more-lessons-to-notebook.png" className="wg-shot-img" alt="Add lesson interface"  width={1920} height={1080} style={{ width: '100%', height: 'auto', }} />
              </div>
            </div>
          </div>
        </div>

        {/* 4. EDITOR (Dual Screenshots) */}
        <div className="wg-feature-section wg-zigzag-row reverse">
          <div className="wg-zigzag-content">
            <div className="wg-tan-card">
              <div className="wg-card-icon"><Icons.Edit /></div>
              <h2 className="wg-card-title">Edit with Map Editor tools</h2>
              <div className="wg-card-body">
                <p>You’re not limited to AI-generated content. Customize lessons to match how you think.</p>
                <ul className="wg-card-list">
                  <li>Create your own flashcards and note cards.</li>
                  <li>Add new topics directly to the map.</li>
                  <li>Co-edit a concept map with collaborators.</li>
                </ul>
                <p>
              This makes WiseGraph a living notebook that grows with your
              understanding, not just a static set of notes.
            </p>
              </div>
            </div>
          </div>
          <div className="wg-zigzag-visual">
            <div className="wg-app-frame">
              {/* BACKGROUND: Social Texture */} 
              <Image src="/textures/social-texture.jpg" className="wg-frame-bg" alt="" aria-hidden="true"   width={1920} height={1080} style={{ width: '100%', height: 'auto', }}/>
              {/* DUAL SCREENSHOTS */}
              <div className="wg-screenshots dual">
                <Image src="/get-started/node-context-menu.png" className="wg-shot-img" alt="Editor tools"  width={1920} height={1080} style={{ width: '100%', height: 'auto', }} />
                <Image src="/get-started/editor-screen-shot.png" className="wg-shot-img" alt="Collaboration panel"  width={1920} height={1080} style={{ width: '100%', height: 'auto', }}/>
              </div>
            </div>
          </div>
        </div>

        {/* 5. STUDY PLAN (Dual Screenshots) */}
        <div className="wg-feature-section wg-zigzag-row">
          <div className="wg-zigzag-content">
            <div className="wg-tan-card">
              <div className="wg-card-icon"><Icons.Calendar /></div>
              <h2 className="wg-card-title">Create a study plan</h2>
              <div className="wg-card-body">
                <p>WiseGraph builds a calm, structured path using spaced repetition. To create a plan, select your notebooks and click <strong>Generate study plan</strong>.</p>
                <ul className="wg-card-list">
                  <li><strong>Interleaved sessions:</strong> Test knowledge across lesson units.</li>
                  <li><strong>Focused revision:</strong> Strengthen weak spots.</li>
                </ul>
              </div>
              <div className="wg-tip-box">
                <span className="wg-tip-label">Pro Tip</span>
                <p className="wg-tip-text">Update your plan whenever you add a big new unit (like a new chapter).</p>
              </div>
            </div>
          </div>
          <div className="wg-zigzag-visual">
            <div className="wg-app-frame">
              {/* BACKGROUND: Schedule Texture */}
              <Image src="/textures/schedule-texture-2.png" className="wg-frame-bg" alt="" aria-hidden="true"  width={1920} height={1080} style={{ width: '100%', height: 'auto', }}/>
              {/* DUAL SCREENSHOTS */}
              <div className="wg-screenshots single">
                <Image src="/get-started/calendar-planner-scene-2.png" className="wg-shot-img" alt="Daily agenda view"  width={1920} height={1080} style={{ width: '100%', height: 'auto', }} />
              </div>
            </div>
          </div>
        </div>

        {/* 6. BOOKMARKS (Single Screenshot) */}
        <div className="wg-feature-section wg-zigzag-row reverse">
           <div className="wg-zigzag-content">
             <div className="wg-tan-card">
               <div className="wg-card-icon"><Icons.Bookmark /></div>
               <h2 className="wg-card-title">Bookmarks</h2>
               <div className="wg-card-body">
                 <p>Never lose track of an important insight.</p>
                 <ul className="wg-card-list">
                   <li>Use bookmarks to track any topic or flash card you want to return to later.</li>
                   <li>Mark tricky concepts, key definitions, or formulas to review before exams.</li>
                 </ul>
               </div>
             </div>
           </div>
           <div className="wg-zigzag-visual">
             <div className="wg-app-frame">
               {/* BACKGROUND: Memory Texture */}  
               <Image src="/textures/memory-retention.jpg" className="wg-frame-bg" alt="" aria-hidden="true"  width={1920} height={1080} style={{ width: '100%', height: 'auto', }} />
               {/* SINGLE SCREENSHOT */}
               <div className="wg-screenshots single">
                 <Image src="/get-started/book-mark.png" className="wg-shot-img" alt="Bookmarks list"  width={1920} height={1080} style={{ width: '100%', height: 'auto', }}/>
               </div>
             </div>
           </div>
        </div>

        {/* 7. AI TOOLS (Dual Screenshots) */}
        <div className="wg-feature-section wg-zigzag-row">
           <div className="wg-zigzag-content">
             <div className="wg-tan-card">
               <div className="wg-card-icon"><Icons.Brain /></div>
               <h2 className="wg-card-title">AI-Assisted Tools</h2>
               <div className="wg-card-body">
                 <strong style={{display:'block', marginBottom:'4px', color:'#E34432'}}>AI Tutor</strong>
                 <p style={{marginBottom:'16px'}}>Whenever you need more clarity on a topic, open the AI Tutor. Ask follow-up questions, request alternative explanations, or connect ideas.</p>
                 
                 <strong style={{display:'block', marginBottom:'4px', color:'#E34432'}}>Explore Topic</strong>
                 <p>Sometimes you don’t need a full lesson. Use Explore Topic to add a single new branch to your concept map for quick side-questions.</p>
               </div>
             </div>
           </div>
           <div className="wg-zigzag-visual">
             <div className="wg-app-frame">
               {/* BACKGROUND: Blue Node Texture (Reused for AI context) */}
               <Image src="/textures/blue-node-texture.jpg" className="wg-frame-bg" alt="" aria-hidden="true"  width={1920} height={1080} style={{ width: '100%', height: 'auto', }} />
               {/* DUAL SCREENSHOTS */}
               <div className="wg-screenshots dual">  
                 <Image src="/get-started/explore-topic-ai-tool.png" className="wg-shot-img" alt="AI Tutor chat"   width={1920} height={1080} style={{ width: '100%', height: 'auto', }}/>
                 <Image src="/get-started/ai-tool-ask-ai-feature.png" className="wg-shot-img" alt="Explore topic result"  width={1920} height={1080} style={{ width: '100%', height: 'auto', }} />
               </div>
             </div>
           </div>
        </div>

        {/* 8. GENERATE QUIZ (Single Screenshot) */}
        <div className="wg-feature-section wg-zigzag-row reverse">
           <div className="wg-zigzag-content">
             <div className="wg-tan-card">
               <div className="wg-card-icon"><Icons.Quiz /></div>
               <h2 className="wg-card-title">Generate Quizzes</h2>
               <div className="wg-card-body">
                 <p>If you need more practice on a topic, select it and choose <strong>Generate quiz</strong>.</p>
                 <p>Use these quizzes to self-test and reinforce what you’ve learned between lessons. Formats include:</p>
                 <ul className="wg-card-list">
                   <li>Matching</li>
                   <li>Multiple choice</li>
                   <li>Fill in the blank</li>
                   <li>True or false</li>
                 </ul>
               </div>
             </div>
           </div>
           <div className="wg-zigzag-visual">
             <div className="wg-app-frame">
               {/* BACKGROUND: Memory Texture (Ideal for quizzes) */}
               <Image src="/textures/memory-retention.jpg" className="wg-frame-bg" alt="" aria-hidden="true"  width={1920} height={1080} style={{ width: '100%', height: 'auto', }} />
               {/* SINGLE SCREENSHOT */}
               <div className="wg-screenshots single">
                 <Image src="/get-started/generate-quiz-tool.png" className="wg-shot-img" alt="Quiz generation screen"  width={1920} height={1080} style={{ width: '100%', height: 'auto', }} />
               </div>
             </div>
           </div>
        </div>

        {/* DIVIDER */}
        <div className="wg-divider-line"></div>

        {/* 9. EDUCATOR FEATURES  */}
        <div className="wg-educator-block">
          <div className="wg-educator-header">
            <span className="wg-educator-badge">Educator Plans</span>
            <h2 className="wg-feature-title">Educator Features</h2>
            <p className="wg-feature-lead">
              Educator accounts include all core features plus powerful tools designed for the classroom.
            </p>
          </div>

          <div className="wg-zigzag-row">
            <div className="wg-zigzag-content">
              <h3 className="wg-card-title">Assigned Quizzes</h3>
              <p className="wg-card-body">
                Assign quizzes directly to students who have access to your notebook. Set deadlines, choose attempt limits, and view grades in the built-in gradebook.
              </p>
              
              <div style={{marginTop: '32px'}}></div>
              
              <h3 className="wg-card-title">Public Uploads</h3>
              <p className="wg-card-body">
                Share learning materials publicly with anyone who has access to your notebooks. Perfect for providing reference materials and readings.
              </p>
            </div>
            <div className="wg-zigzag-visual">
               <div className="wg-app-frame">
                 {/* BACKGROUND: Notebook Stage (Reused for classroom context) */}
                 <Image src="/textures/notebook-stage.jpg" className="wg-frame-bg" alt="" aria-hidden="true"  width={1920} height={1080} style={{ width: '100%', height: 'auto', }}/>
                 {/* DUAL SCREENSHOTS */}
                 <div className="wg-screenshots single">
                   <Image src="/get-started/assigned-quiz-educator.png" className="wg-shot-img" alt="Gradebook view"  width={1920} height={1080} style={{ width: '100%', height: 'auto', }} />
                 </div>
               </div>
            </div>
          </div>
        </div>

        {/* FINAL CTA */}
        <div className="wg-get-started">
          <h2 className="wg-feature-title">You’re ready to get started</h2>
          <p className="wg-feature-lead">
            Now you know the basics of WiseGraph. Create lessons, explore concept maps, build study plans, and bring your peers into the same space.
          </p>
          <a href="/billing/offer" className="wg-big-cta-btn">Start Today</a>
        </div>

      </div>
    </div>
  );
};

export default GettingStartedContent;