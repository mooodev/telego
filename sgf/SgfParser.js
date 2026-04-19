function isUppercaseLetter(char) {
    return char >= 'A' && char <= 'Z';
}

function parsePoint(point) {
    if (!point || point.length < 2) return null;
    return {
        i: point.charCodeAt(0) - 97,
        j: point.charCodeAt(1) - 97,
    };
}

function parseValuesAsPoints(values) {
    return values
        .map(parsePoint)
        .filter(Boolean)
        .map(({ i, j }) => [i, j]);
}

function commentFlags(comment = '') {
    const text = comment.toLowerCase();
    return {
        isCorrect: /\bright\b/.test(text) || /\bcorrect\b/.test(text),
        isWrong: /\bwrong\b/.test(text) || /\bincorrect\b/.test(text),
    };
}

export function parseSgf(text) {
    let index = 0;

    function skipWhitespace() {
        while (index < text.length && /\s/.test(text[index])) index += 1;
    }

    function parseValue() {
        if (text[index] !== '[') throw new Error('Invalid SGF: expected "["');
        index += 1;
        let value = '';
        while (index < text.length) {
            const char = text[index];
            if (char === '\\') {
                index += 1;
                if (index < text.length) value += text[index];
            } else if (char === ']') {
                index += 1;
                break;
            } else {
                value += char;
            }
            index += 1;
        }
        return value;
    }

    function parseProperty() {
        let ident = '';
        while (index < text.length && isUppercaseLetter(text[index])) {
            ident += text[index];
            index += 1;
        }
        if (!ident) return null;
        const values = [];
        skipWhitespace();
        while (text[index] === '[') {
            values.push(parseValue());
            skipWhitespace();
        }
        return [ident, values];
    }

    function parseNode() {
        if (text[index] !== ';') throw new Error('Invalid SGF: expected node');
        index += 1;
        const props = {};
        skipWhitespace();
        while (index < text.length && isUppercaseLetter(text[index])) {
            const [ident, values] = parseProperty();
            props[ident] = values;
            skipWhitespace();
        }
        return { props, children: [] };
    }

    function parseTree() {
        if (text[index] !== '(') throw new Error('Invalid SGF: expected "("');
        index += 1;
        skipWhitespace();

        const nodes = [];
        while (text[index] === ';') {
            nodes.push(parseNode());
            skipWhitespace();
        }

        const variations = [];
        while (text[index] === '(') {
            variations.push(parseTree());
            skipWhitespace();
        }

        if (text[index] !== ')') throw new Error('Invalid SGF: expected ")"');
        index += 1;

        for (let i = 0; i < nodes.length - 1; i++) {
            nodes[i].children.push(nodes[i + 1]);
        }
        if (nodes.length && variations.length) {
            nodes[nodes.length - 1].children.push(...variations.map(tree => tree.root));
        }

        return { root: nodes[0] ?? null };
    }

    skipWhitespace();
    const tree = parseTree();
    if (!tree.root) throw new Error('Invalid SGF: missing root node');
    return buildPuzzleData(tree.root);
}

function buildPuzzleData(root) {
    const tree = transformNode(root);
    const size = Number(root.props.SZ?.[0] ?? '19');
    const currentPlayer = root.props.PL?.[0] === 'W' ? 2 : 1;
    const title = root.props.GN?.[0] ?? root.props.N?.[0] ?? 'SGF Puzzle';
    const comment = root.props.C?.[0] ?? '';

    return {
        title,
        size,
        currentPlayer,
        comment,
        hasExplicitMarks: tree.hasExplicitMarks,
        setup: {
            black: parseValuesAsPoints(root.props.AB ?? []),
            white: parseValuesAsPoints(root.props.AW ?? []),
        },
        tree,
    };
}

function transformNode(node) {
    const move = node.props.B?.[0] !== undefined
        ? { color: 1, point: parsePoint(node.props.B[0]), pass: node.props.B[0] === '' }
        : node.props.W?.[0] !== undefined
            ? { color: 2, point: parsePoint(node.props.W[0]), pass: node.props.W[0] === '' }
            : null;

    const comment = node.props.C?.[0] ?? '';
    const flags = commentFlags(comment);

    const children = node.children.map(transformNode);
    const hasExplicitMarks = flags.isCorrect || flags.isWrong || children.some(child => child.hasExplicitMarks);

    return {
        move,
        comment,
        ...flags,
        hasExplicitMarks,
        children,
    };
}
