'use client';

/**
 * @file features-page.tsx
 * @description The main content component for the Features/Getting Started page.
 * Renders the single-scroll layout with Zig-Zag sections using Brand Assets.
 */

import React from 'react';
import './features-page.css';

// Icons (Inline SVG for zero dependencies, styled to look like 'light brown')
const Icons = {
  Notebook: () => (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>
  ),
  Map: () => (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M3 12h3"></path><path d="M18 12h3"></path><path d="M12 3v3"></path><path d="M12 18v3"></path><path d="M19.07 4.93 17 7"></path><path d="M7 17l-2.07 2.07"></path><path d="M19.07 19.07 17 17"></path><path d="M7 7l-2.07-2.07"></path></svg>
  ),
  Upload: () => (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
  ),
  Edit: () => (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>
  ),
  Calendar: () => (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
  ),
  Bookmark: () => (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"></path></svg>
  ),
  Brain: () => (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z"></path><path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2Z"></path></svg>
  ),
  Quiz: () => (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path><polyline points="14 2 14 8 20 8"></polyline><path d="m9 15 2 2 4-4"></path></svg>
  ),
  Educator: () => (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path></svg>
  )
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

        {/* ZIG ZAG SECTION 1: CREATE */}
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
                <p>WiseGraph will analyze your file and return one or two concept maps. Each concept map represents a single lesson unit.</p>
              </div>
              <div className="wg-tip-box">
                <span className="wg-tip-label">Quick Tip</span>
                <p className="wg-tip-text">Upload one chapter per lesson to keep your concept maps clear and easy to revise.</p>
              </div>
            </div>
          </div>
          <div className="wg-zigzag-visual">
            <div className="wg-app-frame">
              {/* USING: Scene 1 Stage (Upload context) public/textures/blue-node-texture.jpg */}
              <img 
                src="/textures/notebook-stage.jpg" 
                alt="WiseGraph Upload Interface" 
                style={{ objectFit: 'cover' }}
                onError={(e) => e.currentTarget.style.display = 'none'} 
              />

            </div>
          </div>
        </div>

        {/* ZIG ZAG SECTION 2: EXPLORE (REVERSE) */}
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
                <p>Select "Start lesson" for a full session, or click specific nodes to "Start slide show".</p>
              </div>
              <div className="wg-tip-box">
                <span className="wg-tip-label">Helpful Hints</span>
                <p className="wg-tip-text">Use blue nodes as your “anchor” topics. Drill into nested nodes when you’re ready for more detail.</p>
              </div>
            </div>
          </div>
          <div className="wg-zigzag-visual">
            <div className="wg-app-frame">
               {/* USING: Hero Shot High Res (Concept Map) */}
               <img 
                 src="/textures/blue-node-texture.jpg" 
                 alt="WiseGraph Concept Map View" 
                 style={{ objectFit: 'cover' }}
                 onError={(e) => e.currentTarget.style.display = 'none'} 
               />
            </div>
          </div>
        </div>

        {/* ZIG ZAG SECTION 3: ADD MORE */}
        <div className="wg-feature-section wg-zigzag-row">
          <div className="wg-zigzag-content">
            <div className="wg-tan-card">
              <div className="wg-card-icon"><Icons.Upload /></div>
              <h2 className="wg-card-title">Add more lessons to your notebook</h2>
              <div className="wg-card-body">
                <p>You can keep expanding a notebook as you study a course over time. Whenever you’re ready, select <strong>Generate lesson</strong> again.</p>
                <p>New concept maps will be added to the same notebook so you can build a rich, connected study hub for each course.</p>
              </div>
            </div>
          </div>
          <div className="wg-zigzag-visual">
            <div className="wg-app-frame">
               {/* RE-USING: Scene 1 Stage or similar Notebook view if available. 
                   Using scene1stage again as it depicts the 'notebook/upload' environment well. */}
               <img 
                 src="/textures/blue-node-texture.jpg" 
                 alt="Notebook dashboard" 
                 style={{ objectFit: 'cover' }}
                 onError={(e) => e.currentTarget.style.display = 'none'} 
               />
            </div>
          </div>
        </div>

        {/* ZIG ZAG SECTION 4: EDITOR (REVERSE) */}
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
                <p>This makes WiseGraph a living notebook that grows with your understanding.</p>
              </div>
            </div>
          </div>
          <div className="wg-zigzag-visual">
            <div className="wg-app-frame">
               {/* USING: Scene 4 Stage (Collaboration/Editor context) */}
               <img 
                 src="/textures/social-texture.jpg" 
                 alt="Map Editor and Collaboration Interface" 
                 style={{ objectFit: 'cover' }}
                 onError={(e) => e.currentTarget.style.display = 'none'} 
               />
            </div>
          </div>
        </div>

        {/* ZIG ZAG SECTION 5: STUDY PLAN */}
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
               {/* USING: Scene 2 Stage (Calendar context) C:\Users\jneva\wisegraph\Bloom-map\public\textures\schedule-texture-2.png */}
               <img 
                 src="/textures/schedule-texture-2.png" 
                 alt="Study Calendar Plan View" 
                 style={{ objectFit: 'cover' }}
                 onError={(e) => e.currentTarget.style.display = 'none'} 
               />
            </div>
          </div>
        </div>

        {/* ZIG ZAG SECTION 6: BOOKMARKS (REVERSE) */}
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
               {/* Fallback or reuse Scene 3 (Retention) if applicable, otherwise keeping placeholder path */}
               <img src="/features/bookmarks-ui.png" alt="Interface showing bookmarked items" 
                    onError={(e) => e.currentTarget.style.display = 'none'} />
             </div>
           </div>
        </div>

        {/* ZIG ZAG SECTION 7: AI TOOLS (NORMAL) */}
        <div className="wg-feature-section wg-zigzag-row">
           <div className="wg-zigzag-content">
             <div className="wg-tan-card">
               <div className="wg-card-icon"><Icons.Brain /></div>
               <h2 className="wg-card-title">AI-Assisted Tools</h2>
               <div className="wg-card-body">
                 <strong style={{display:'block', marginBottom:'4px', color:'#E34432'}}>AI Tutor</strong>
                 <p style={{marginBottom:'16px'}}>Whenever you need more clarity on a topic, open the AI Tutor. Ask follow-up questions, request alternative explanations, or connect ideas across different topics.</p>
                 
                 <strong style={{display:'block', marginBottom:'4px', color:'#E34432'}}>Explore Topic</strong>
                 <p>Sometimes you don’t need a full lesson. Use Explore Topic to add a single new branch to your concept map for quick side-questions that aren’t part of your main upload.</p>
               </div>
             </div>
           </div>
           <div className="wg-zigzag-visual">
             <div className="wg-app-frame">
               <img src="/features/ai-tutor-ui.png" alt="AI Chat Interface" 
                    onError={(e) => e.currentTarget.style.display = 'none'} />
             </div>
           </div>
        </div>

        {/* ZIG ZAG SECTION 8: QUIZZES (REVERSE) */}
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
               <img src="/textures/memory-retention.jpg" alt="Quiz Interface" 
                    onError={(e) => e.currentTarget.style.display = 'none'} />
             </div>
           </div>
        </div>

        {/* DIVIDER */}
        <div className="wg-divider-line"></div>

        {/* EDUCATOR SECTION */}
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
                 <img src="/textures/notebook-stage.jpg" alt="Educator Dashboard" 
                      onError={(e) => e.currentTarget.style.display = 'none'} />
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