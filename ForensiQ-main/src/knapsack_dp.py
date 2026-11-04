
def multiple_knapsack_dp(evidence, analysts):
    """
    Allocate evidence among 1 to 3 analysts using
    Dynamic Programming.
    """

    # Validate number of analysts
    k = len(analysts)

    if k < 1 or k > 3:
        raise ValueError("The system supports 1 to 3 analysts.")

    # Validate analyst names
    if analysts["analyst_name"].duplicated().any():
        raise ValueError("Duplicate analyst names are not allowed.")

    # Extract input data
    capacities = analysts["capacity_hours"].tolist()
    weights = evidence["examination_hours"].tolist()
    values = evidence["estimated_value"].tolist()

    n = len(evidence)

    # Validate capacities
    if any(capacity < 0 for capacity in capacities):
        raise ValueError("Analyst capacities cannot be negative.")

    # Validate evidence hours and values
    if any(weight < 0 for weight in weights):
        raise ValueError("Evidence examination hours cannot be negative.")

    if any(value < 0 for value in values):
        raise ValueError("Evidence values cannot be negative.")

    print("Number of evidence items:", n)
    print("Number of analysts:", k)
    print("Analyst capacities:", capacities)

    # State = tuple of used hours for each analyst
    initial_state = tuple(0 for _ in range(k))

    dp = {initial_state: 0}
    parent = {}

    for i in range(n):

        weight = weights[i]
        value = values[i]

        new_dp = {}

        for used_hours, current_value in dp.items():

            # Option 1: Skip current evidence
            skip_state = (i + 1, *used_hours)

            if (
                used_hours not in new_dp
                or current_value > new_dp[used_hours]
            ):
                new_dp[used_hours] = current_value

                parent[skip_state] = (
                    (i, *used_hours), None
                )

            # Option 2: Assign evidence to one analyst
            for j in range(k):

                if used_hours[j] + weight <= capacities[j]:

                    updated_hours = list(used_hours)
                    updated_hours[j] += weight
                    updated_hours = tuple(updated_hours)

                    new_value = current_value + value

                    new_state = (i + 1, *updated_hours)

                    if (
                        updated_hours not in new_dp
                        or new_value > new_dp[updated_hours]
                    ):
                        new_dp[updated_hours] = new_value

                        parent[new_state] = (
                            (i, *used_hours), j
                        )

        dp = new_dp

    # Find the state with maximum total value
    best_used_hours = max(dp, key=dp.get)

    maximum_value = dp[best_used_hours]

    best_state = (n, *best_used_hours)

    # Prepare analyst allocation
    allocation = {
        analysts.iloc[j]["analyst_name"]: []
        for j in range(k)
    }

    # Backtrack to reconstruct assignments
    current_state = best_state

    while current_state[0] > 0:

        previous_state, analyst_index = parent[current_state]

        if analyst_index is not None:

            analyst_name = analysts.iloc[
                analyst_index
            ]["analyst_name"]

            item_index = current_state[0] - 1

            allocation[analyst_name].append(
                evidence.iloc[item_index].to_dict()
            )

        current_state = previous_state

    # Restore original evidence order
    for analyst_name in allocation:
        allocation[analyst_name].reverse()

    return maximum_value, allocation
