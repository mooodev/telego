function parseGithubTreeUrl(urlString) {
    const url = new URL(urlString);
    const parts = url.pathname.split('/').filter(Boolean);
    if (url.hostname !== 'github.com' || parts.length < 4 || parts[2] !== 'tree') {
        throw new Error('Use a GitHub folder URL like /owner/repo/tree/branch/path');
    }

    return {
        owner: parts[0],
        repo: parts[1],
        branch: parts[3],
        path: parts.slice(4).join('/'),
    };
}

async function fetchContents(owner, repo, branch, path) {
    const pathPart = path ? `/${path}` : '';
    const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents${pathPart}?ref=${branch}`);
    if (!response.ok) {
        throw new Error(`GitHub contents request failed (${response.status})`);
    }
    return response.json();
}

async function walk(owner, repo, branch, path) {
    const entries = await fetchContents(owner, repo, branch, path);
    const list = Array.isArray(entries) ? entries : [entries];
    const files = [];

    for (const entry of list) {
        if (entry.type === 'dir') {
            files.push(...await walk(owner, repo, branch, entry.path));
            continue;
        }
        if (entry.type === 'file' && entry.name.toLowerCase().endsWith('.sgf')) {
            files.push({
                name: entry.name,
                path: entry.path,
                rawUrl: `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${entry.path}`,
            });
        }
    }

    return files;
}

export async function loadGithubPuzzleList(urlString) {
    const { owner, repo, branch, path } = parseGithubTreeUrl(urlString);
    const files = await walk(owner, repo, branch, path);
    files.sort((a, b) => a.path.localeCompare(b.path));
    return files;
}
