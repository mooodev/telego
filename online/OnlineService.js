import { loadGithubPuzzleList } from '../puzzles/GitHubPuzzleSource.js';

const DEFAULT_PUZZLE_SOURCE = 'https://github.com/gogameguru/go-problems/tree/master/weekly-go-problems';

function isGithubTreeUrl(value = '') {
    try {
        const url = new URL(value);
        const parts = url.pathname.split('/').filter(Boolean);
        return url.hostname === 'github.com' && parts[2] === 'tree';
    } catch {
        return false;
    }
}

export class OnlineService {
    constructor() {
        this.defaultPuzzleSource = DEFAULT_PUZZLE_SOURCE;
    }

    getCapabilities() {
        return {
            providers: ['github-tree', 'raw-sgf-url'],
            defaultPuzzleSource: this.defaultPuzzleSource,
            supportsRemotePuzzleList: true,
            supportsRemotePuzzleFile: true,
        };
    }

    getDefaultPuzzleSource() {
        return this.defaultPuzzleSource;
    }

    describeSource(sourceUrl) {
        if (!sourceUrl) {
            return {
                type: 'empty',
                label: 'No source selected',
            };
        }

        if (isGithubTreeUrl(sourceUrl)) {
            return {
                type: 'github-tree',
                label: 'GitHub folder',
                url: sourceUrl,
            };
        }

        return {
            type: 'remote-file',
            label: 'Direct SGF URL',
            url: sourceUrl,
        };
    }

    async loadPuzzleList(sourceUrl) {
        if (!sourceUrl) throw new Error('Puzzle source URL is empty');
        return loadGithubPuzzleList(sourceUrl);
    }

    async loadPuzzleText(url) {
        if (!url) throw new Error('Puzzle URL is empty');

        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`SGF fetch failed (${response.status})`);
        }

        return response.text();
    }
}
