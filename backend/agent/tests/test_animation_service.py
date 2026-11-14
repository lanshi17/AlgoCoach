from app.remotion.animation_service import PREBUILT, animation_service


def test_prebuilt_mapping_only_targets_registered_compositions():
    registered = {
        "BacktrackingTree",
        "BinarySearch",
        "BfsGraph",
        "DfsTree",
        "Dijkstra",
        "DpTable",
        "GridBfs",
        "HeapSort",
        "LinkedListOps",
        "SolutionCompare",
        "SortVisualizer",
        "SlidingWindow",
        "TwoPointer",
        "UnionFind",
        "WeeklyReport",
    }

    assert set(PREBUILT.values()) <= registered
    assert animation_service._guess_component("DP_TABLE") == "DpTable"
    assert animation_service._guess_component("BINARY_SEARCH") == "BinarySearch"
    assert animation_service._guess_component("并查集") == "UnionFind"
    assert animation_service._guess_component("UNSUPPORTED_GRAPH_TOPIC") == "BfsGraph"
