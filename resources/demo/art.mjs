/** Original SVG illustrations. Every frame is local, deterministic and serializable. */
const svg = body => `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">${body}</svg>`;
const frames = make => Array.from({ length:16 }, (_, i) => svg(make(i / 16 * Math.PI * 2)));
export const sprites = {
  drone: { width:44, height:44, fps:16, frames:frames(t => `
    <ellipse cx="32" cy="53" rx="19" ry="5" fill="#071c29" opacity=".5"/>
    <g transform="translate(0 ${Math.sin(t)*1.4})">
    <path d="M22 45L25 ${54+Math.sin(t)*3}L29 45M35 45L39 ${54-Math.sin(t)*3}L42 45" fill="#7cf8db"/>
    <path d="M13 28L5 34V43L16 40M51 28L59 34V43L48 40" fill="#759fb1" stroke="#c4e8e3" stroke-width="2"/>
    <rect x="13" y="13" width="38" height="36" rx="15" fill="#f0edcf" stroke="#acccc7" stroke-width="2"/>
    <rect x="18" y="23" width="28" height="17" rx="8" fill="#163a4b"/>
    <path d="M23 29h5m8 0h5" stroke="#8fffe2" stroke-width="4" stroke-linecap="round"/>
    <path d="M28 35q4 3 8 0" fill="none" stroke="#65cabd" stroke-width="1.4"/>
    <path d="M32 13V7" stroke="#d7eadb" stroke-width="3"/><circle cx="32" cy="6" r="3" fill="#ffc776"/>
    <path d="M23 17h16" stroke="#fffcec" stroke-width="3" stroke-linecap="round"/>
    </g>`) },
  cell: { width:32, height:32, fps:16, frames:frames(t => `
    <circle cx="32" cy="32" r="27" fill="#97ffe0" opacity="${.06+Math.sin(t)*.02}"/>
    <g transform="translate(0 ${Math.sin(t)*3}) rotate(${Math.sin(t)*7} 32 32)">
    <path d="M32 10L47 23L43 45L32 53L20 43L17 23Z" fill="#7cebc4" stroke="#d4ffe6" stroke-width="2"/>
    <path d="M32 10L29 29L47 23L32 37L43 45L32 53L32 37L20 43L29 29L17 23Z" fill="#32b0a8"/>
    <path d="M32 17L35 27L43 28L34 34L30 46L29 35L22 30L29 28Z" fill="#eeffe6"/>
    </g>`) },
  wall: { width:48,height:48,frames:[svg(`<rect x="2" y="3" width="60" height="59" rx="11" fill="#122a3d" stroke="#395566" stroke-width="2"/><rect x="7" y="8" width="50" height="44" rx="7" fill="#263e51"/><path d="M10 12h44M12 18v22M52 20v22" stroke="#466273" stroke-width="2"/><path d="M12 57h40" stroke="#081c2d" stroke-width="3"/><circle cx="13" cy="13" r="2" fill="#91b5bd"/><circle cx="51" cy="13" r="2" fill="#91b5bd"/><path d="M24 25h16v15H24z" fill="#1c3346"/><path d="M28 29h8v7h-8z" fill="#304d60"/>`)] },
  gate: { width:48,height:48,fps:16,frames:frames(t => `<rect x="4" y="3" width="10" height="58" rx="3" fill="#64707c"/><rect x="50" y="3" width="10" height="58" rx="3" fill="#64707c"/><path d="M14 10H50M14 21H50M14 32H50M14 43H50M14 54H50" stroke="#f7b67d" stroke-width="5" opacity="${.5+Math.sin(t)*.17}"/><path d="M8 11v42M56 11v42" stroke="#ffe8b7" stroke-width="2"/>`) },
  portal: { width:62,height:62,fps:16,frames:frames(t => `<circle cx="32" cy="32" r="27" fill="#121d3c" stroke="#8d8acb" stroke-width="3"/><circle cx="32" cy="32" r="20" fill="#6652ac" opacity=".35"/><ellipse cx="32" cy="32" rx="${13+Math.sin(t)*2}" ry="20" fill="none" stroke="#c2b1ff" stroke-width="2"/><ellipse cx="32" cy="32" rx="20" ry="${10+Math.cos(t)*2}" fill="none" stroke="#8f84d1" stroke-width="2"/><path d="M29 23L39 32L29 41" stroke="#efe8ff" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`) },
  sentinel: { width:38,height:38,fps:16,frames:frames(t => `<g transform="rotate(${Math.sin(t)*7} 32 32)"><path d="M32 5L47 17L58 32L47 47L32 59L17 47L6 32L17 17Z" fill="#734b87" stroke="#b58abd" stroke-width="2"/><circle cx="32" cy="32" r="17" fill="#362f52"/><path d="M21 29h22" stroke="#f4bdc6" stroke-width="5"/><circle cx="32" cy="29" r="4" fill="#fff0cc"/><path d="M22 44h20" stroke="#9b719e" stroke-width="3"/></g>`) },
  pulse: { width:42,height:42,frames:[svg(`<circle cx="32" cy="32" r="24" fill="none" stroke="#8ce6d9" stroke-width="3"/><circle cx="32" cy="32" r="16" fill="none" stroke="#52a6ad" stroke-width="2"/><path d="M33 10L23 33H32L29 54L43 29H34Z" fill="#e4fff2"/>`)] },
  move: { width:40,height:40,frames:[svg(`<circle cx="32" cy="32" r="24" fill="none" stroke="#749ca8" stroke-width="2"/><path d="M14 17L48 32L33 36L28 51Z" fill="#cbe9dd" stroke="#ecfff4" stroke-width="2"/>`)] },
  spark: { width:22,height:22,frames:[svg(`<path d="M32 2L38 24L60 32L38 39L32 62L25 39L3 32L25 24Z" fill="#d9ffe2"/>`)] },
};
