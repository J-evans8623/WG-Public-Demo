/***************************************************************************************
 * @file NotesTab.tsx
 * @description
 *   Renders all resource cards linked to the currently-selected concept-map nodes and
 *   provides CRUD operations.  The bottom action bar now uses the dedicated
 *   `.bottom-bar` class, giving it a darker divider and subtle inset shadow to match
 *   the new design language.
 ***************************************************************************************/

import React, { useState, useImperativeHandle, forwardRef } from 'react';
import { ResourceType as CardResourceType } from './buttons/AddResourceDropdown';
import ResourceDisplay from './ResourceDisplay';
import { useResourceSync } from '@/app/studygraph/(studygraph)/components/hooks/useResourceSync';
import useCardCrudOperations from '@/app/studygraph/(studygraph)/components/hooks/useCardCrudOperations';
import { ResourceCard } from '@/app/Library/Definitions/Definitions';
import AddResourceDropdown from './buttons/AddResourceDropdown';
import '@/app/studygraph/(studygraph)/components/layout/scrollbar.css';

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */
interface PendingResource{
  nodeId   : string;
  type     : CardResourceType;
  title    : string;
  content  : string;
  description?: string;
  image?     : File;
}
interface NotesTabProps{
  currentTopicTitle : string;
  isEditMode        : boolean;
  onSwitchToChat    : () => void;
  width             : number;
}
export type NotesTabRef = { handleAddResource:(t:CardResourceType)=>void };

/* -------------------------------------------------------------------------- */
/* Helper fns                                                                 */
/* -------------------------------------------------------------------------- */
const getResourceContent = (r:ResourceCard) =>{
  switch(r.type){
    case 'cueCard':
    case 'note':
    case 'practiceSheet':   return r.content;
    case 'picture':         return r.description || '';
    default:                return '';
  }
};
const updateResourceContent = (r:ResourceCard,newContent:string) =>{
  switch(r.type){
    case 'cueCard':
    case 'note':
    case 'practiceSheet':   return { content:newContent };
    case 'picture':         return { description:newContent };
    default:                return {};
  }
};
const mapResourceTypeForDisplay = (t:'cueCard'|'note'|'picture'|'practiceSheet'):CardResourceType=>{
  switch(t){
    case 'cueCard'       : return 'cuecard';
    case 'note'          : return 'note';
    case 'picture'       : return 'image';
    case 'practiceSheet' : return 'quiz';
    default              : return 'cuecard';
  }
};

/* -------------------------------------------------------------------------- */
/* Component                                                                  */
/* -------------------------------------------------------------------------- */
const NotesTab = forwardRef<NotesTabRef,NotesTabProps>(({
  currentTopicTitle,isEditMode,onSwitchToChat,width
},ref)=>{

  /* ---------------------------------------------------------------------- */
  /* Data sync & CRUD hooks                                                 */
  /* ---------------------------------------------------------------------- */
  const { selectedNodeIds,cueCards,pictures,practiceSheets,notes } = useResourceSync();
  const resources = [...cueCards,...notes,...pictures,...practiceSheets];
  const { createResource,updateResource,deleteResource } = useCardCrudOperations();

  /* ---------------------------------------------------------------------- */
  /* Local state                                                            */
  /* ---------------------------------------------------------------------- */
  const [pending,setPending]                 = useState<PendingResource[]>([]);
  const [editingIds,setEditingIds]           = useState<Set<string>>(new Set());
  const [editingContent,setEditingContent]   = useState<Record<string,{title:string;content:string}>>({});

  /* ---------------------------------------------------------------------- */
  /* Imperative handle                                                      */
  /* ---------------------------------------------------------------------- */
  useImperativeHandle(ref,()=>({
    handleAddResource:(type:CardResourceType)=>{
      const nodeDefault = selectedNodeIds[0] ?? '';
      setPending(prev=>[...prev,{
        nodeId:nodeDefault,
        type,
        title:'',
        content:'',
        description:type==='image'?'':undefined
      }]);
    }
  }));

  /* ---------------------------------------------------------------------- */
  /* Helpers for pending resources                                          */
  /* ---------------------------------------------------------------------- */
  const savePending=async(index:number,data:{
    title:string;content:string;image?:File;description?:string;selectedTopicId?:string;
  })=>{
    const draft=pending[index]; if(!draft) return;
    const nodeIdFinal = data.selectedTopicId ?? draft.nodeId;
    await createResource({
      nodeId:nodeIdFinal,
      type  :draft.type,
      title :data.title,
      content:data.content,
      image :data.image,
      description:data.description
    });
    setPending(prev=>prev.filter((_,i)=>i!==index));
  };
  const cancelPending=(i:number)=>setPending(prev=>prev.filter((_,idx)=>idx!==i));

  /* ---------------------------------------------------------------------- */
  /* Toggle edit for existing cards                                         */
  /* ---------------------------------------------------------------------- */
  const toggleEdit=(id:string)=>{
    setEditingIds(prev=>{
      const next = new Set(prev);
      if(next.has(id)){
        next.delete(id);
        setEditingContent(c=>{ const x={...c}; delete x[id]; return x; });
      }else{
        const res=resources.find(r=>r.id===id);
        if(res){
          next.add(id);
          setEditingContent(c=>({
            ...c,
            [id]:{ title:res.title, content:getResourceContent(res) as string }
          }));
        }
      }
      return next;
    });
  };

  /* ---------------------------------------------------------------------- */
  /* Update existing resource                                               */
  /* ---------------------------------------------------------------------- */
  const persistEdits=async(id:string)=>{
    const res = resources.find(r=>r.id===id); if(!res) return;
    const changes = editingContent[id];
    if(!changes) return;
    await updateResource(res,{
      title:changes.title,
      ...updateResourceContent(res,changes.content)
    });
    setEditingIds(s=>{ const n=new Set(s); n.delete(id); return n; });
    setEditingContent(c=>{ const n={...c}; delete n[id]; return n; });
  };

  /* ---------------------------------------------------------------------- */
  /* Render                                                                 */
  /* ---------------------------------------------------------------------- */
  return(
    <div className="relative h-full flex flex-col">
      {/* scroll container -------------------------------------------------- */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 custom-scrollbar">
        <div className="space-y-4 py-4">
          {/* pending drafts */}
          {pending.map((p,i)=>(
            <ResourceDisplay
              key={`pending-${i}`}
              id={`pending-${i}`}
              type={p.type}
              topicTitle={currentTopicTitle}
              title={p.title}
              content={p.content}
              isEditing
              onTitleChange={t=>setPending(prev=>{
                const copy=[...prev]; copy[i]={...p,title:t}; return copy;
              })}
              onContentChange={c=>setPending(prev=>{
                const copy=[...prev]; copy[i]={...p,content:c}; return copy;
              })}
              onCancel={()=>cancelPending(i)}
              onSave={d=>savePending(i,{
                title:p.title,content:p.content,description:p.description,image:d?.file,
                selectedTopicId:d?.selectedTopicId
              })}
              onEdit={()=>{}}
              onDelete={()=>cancelPending(i)}
              onAskAI={onSwitchToChat}
              onImageCaption={()=>{}}
            />
          ))}

          {/* existing resources */}
          {selectedNodeIds.length===0 && (
            <p className="text-gray-600">Select nodes to view their resources.</p>
          )}
          {selectedNodeIds.length>0 && resources.length===0 && (
            <p className="text-gray-600">No resources available for the selected nodes.</p>
          )}
          {resources.map(r=>(
            <ResourceDisplay
              key={r.id}
              id={r.id}
              type={mapResourceTypeForDisplay(r.type)}
              topicTitle={r.conceptNodeTitle||currentTopicTitle}
              title={editingContent[r.id]?.title ?? r.title}
              content={editingContent[r.id]?.content ?? getResourceContent(r)}
              isEditing={editingIds.has(r.id)}
              imageUrl={r.type==='picture'? r.imageUrl : undefined}
              onTitleChange={t=>setEditingContent(c=>({ ...c,[r.id]:{...(c[r.id]||{}),title:t} }))}
              onContentChange={c=>setEditingContent(prev=>({ ...prev,[r.id]:{...(prev[r.id]||{}),content:c} }))}
              onCancel={()=>toggleEdit(r.id)}
              onSave={()=>persistEdits(r.id)}
              onEdit={()=>toggleEdit(r.id)}
              onDelete={()=>deleteResource(r.nodeId,r.id)}
              onAskAI={onSwitchToChat}
              onImageCaption={()=>{}}
            />
          ))}
        </div>
      </div>

      {/* bottom action bar ------------------------------------------------- */}
      <div className="bottom-bar">
        <AddResourceDropdown onSelectType={type=>ref?.current?.handleAddResource(type)} />
      </div>
    </div>
  );
});
NotesTab.displayName='NotesTab';
export default NotesTab;
