function padNumber(value) {
    return String(value).padStart(2, '0');
}

function buildSeries({ prefix, folder, count, diff, category }) {
    return Array.from({ length: count }, (_, index) => {
        const number = index + 1;
        const code = `${prefix}-${padNumber(number)}`;
        return {
            id: `${folder}-${number}`,
            code,
            title: `${diff} Puzzle #${padNumber(number)}`,
            diff,
            category,
            sgfPath: `./puzzles/library/${folder}/${code}.sgf`,
            source: 'Go Game Guru',
        };
    });
}

export const localPuzzleLibrary = [
    ...buildSeries({ prefix: 'ggg-easy', folder: 'easy', count: 140, diff: 'Beginner', category: 'Capture' }),
    ...buildSeries({ prefix: 'ggg-intermediate', folder: 'intermediate', count: 140, diff: 'Intermediate', category: 'Life & Death' }),
    ...buildSeries({ prefix: 'ggg-hard', folder: 'hard', count: 140, diff: 'Advanced', category: 'Tesuji' }),
    {
        id: 'other-eternal-life',
        code: 'ggg-eternal-life',
        title: 'Eternal Life',
        diff: 'Advanced',
        category: 'Special',
        sgfPath: './puzzles/library/other/ggg-eternal-life.sgf',
        source: 'Go Game Guru',
    },
    {
        id: 'other-heart',
        code: 'heart-go-problem',
        title: 'Heart Go Problem',
        diff: 'Intermediate',
        category: 'Special',
        sgfPath: './puzzles/library/other/heart-go-problem.sgf',
        source: 'Go Game Guru',
    },
];
