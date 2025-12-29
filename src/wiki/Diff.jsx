import React, { useState, useEffect } from 'react';
import { API } from './api';

const simpleDiff = (text1, text2) => {
    const lines1 = text1.split('\n');
    const lines2 = text2.split('\n');
    const maxLines = Math.max(lines1.length, lines2.length);
    const diff = [];

    // Very naive line-by-line diff.
    // Real diff algorithms are complex (Myers O(ND)),
    // but for "no dependencies" and "minimal", this helps visualize changes loosely.
    // We will just show lines that don't match index-for-index as changed.
    // For a better experience without deps, we can try to find matching lines.

    let i = 0, j = 0;
    while(i < lines1.length || j < lines2.length) {
        if (lines1[i] === lines2[j]) {
            diff.push({ type: 'same', content: lines1[i] });
            i++; j++;
        } else {
             // Look ahead to see if it was an insertion or deletion
             // Simple heuristic: if line1[i] exists in lines2 later, it's an insertion in 2.
             // If line2[j] exists in lines1 later, it's a deletion from 1.

             const in2 = lines2.indexOf(lines1[i], j);
             const in1 = lines1.indexOf(lines2[j], i);

             if (in2 > -1 && (in1 === -1 || in2 < in1)) {
                 // Insertion in 2 (lines added)
                 while(j < in2) {
                     diff.push({ type: 'added', content: lines2[j] });
                     j++;
                 }
             } else if (in1 > -1) {
                 // Deletion from 1 (lines removed)
                 while(i < in1) {
                     diff.push({ type: 'removed', content: lines1[i] });
                     i++;
                 }
             } else {
                 // Modified line (just show remove then add)
                 if (i < lines1.length) { diff.push({ type: 'removed', content: lines1[i] }); i++; }
                 if (j < lines2.length) { diff.push({ type: 'added', content: lines2[j] }); j++; }
             }
        }
    }

    return diff;
};

export default function Diff({ pageId, v1, v2, navigate }) {
    const [diffData, setDiffData] = useState(null);

    useEffect(() => {
        API.fetchPage(pageId).then(data => {
            const rev1 = data.revisions.find(r => r.version === parseInt(v1));
            const rev2 = data.revisions.find(r => r.version === parseInt(v2));
            if (rev1 && rev2) {
                setDiffData({
                    v1: rev1,
                    v2: rev2,
                    diff: simpleDiff(rev1.content, rev2.content)
                });
            }
        });
    }, [pageId, v1, v2]);

    if (!diffData) return <div className="wiki-content">Loading diff...</div>;

    return (
        <>
           <div className="wiki-header">
             <h1 className="wiki-title">Compare V{v1} vs V{v2}</h1>
             <div className="wiki-actions">
               <button onClick={() => navigate('history', { id: pageId })}>Back to History</button>
             </div>
           </div>

           <div className="wiki-content">
               <div style={{fontFamily: 'monospace', whiteSpace: 'pre-wrap', background: '#fff', padding: '16px', border: '1px solid #eee'}}>
                   {diffData.diff.map((line, idx) => (
                       <div key={idx} className={line.type === 'added' ? 'diff-added' : line.type === 'removed' ? 'diff-removed' : ''}>
                           {line.type === 'added' ? '+ ' : line.type === 'removed' ? '- ' : '  '}
                           {line.content}
                       </div>
                   ))}
               </div>
           </div>
        </>
    );
}
