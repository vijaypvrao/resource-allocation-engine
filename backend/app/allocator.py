"""Public allocation strategy API; implementations live in focused modules."""
from .greedy_strategy import greedy
from .hungarian_strategy import hungarian
from .comparison import determine_winner

__all__ = ["greedy", "hungarian", "determine_winner"]
