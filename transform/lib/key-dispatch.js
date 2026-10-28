export function keyDispatch(members, key) {
    if (members.length <= 8)
        return { members };
    const sorted = members
        .map((member, order) => ({ member, key: key(member), order }))
        .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
    const build = (start, end, offset) => {
        const first = sorted[start].key;
        const last = sorted[end - 1].key;
        if (end - start <= 8 || first === last)
            return {
                members: sorted
                    .slice(start, end)
                    .sort((a, b) => a.order - b.order)
                    .map((entry) => entry.member),
            };
        while (first.charCodeAt(offset) === last.charCodeAt(offset))
            offset++;
        const pivot = (first.charCodeAt(offset) + last.charCodeAt(offset) + 1) >>> 1;
        let lo = start;
        let hi = end;
        while (lo < hi) {
            const mid = (lo + hi) >>> 1;
            if (sorted[mid].key.charCodeAt(offset) < pivot)
                lo = mid + 1;
            else
                hi = mid;
        }
        return {
            offset,
            pivot,
            left: build(start, lo, offset),
            right: build(lo, end, offset),
        };
    };
    return build(0, sorted.length, 0);
}
