
def multiple_knapsack_dp(evidence, analysts):
    """
    Allocate evidence among analysts using Dynamic Programming.
    """

    # Get analyst capacities
    capacities = analysts["capacity_hours"].tolist()

    # Get evidence examination hours
    weights = evidence["examination_hours"].tolist()

    # Get evidence estimated values
    values = evidence["estimated_value"].tolist()

    # Count evidence items and analysts
    n = len(evidence)
    k = len(analysts)

    print("Number of evidence items:", n)
    print("Number of analysts:", k)
    print("Analyst capacities:", capacities)

    # Create the DP table
    dp = {}
    dp[(0, 0, 0, 0)] = 0

    # Store previous states and decisions for backtracking
    parent = {}

    # Process each evidence item
    for i in range(n):

        weight = weights[i]
        value = values[i]

        # Store new DP states
        new_dp = {}

        # Check all previous states
        for state, current_value in dp.items():

            _, c1, c2, c3 = state

            # Option 1: Skip the evidence
            new_state = (i + 1, c1, c2, c3)

            if new_state not in new_dp or current_value > new_dp[new_state]:
                new_dp[new_state] = current_value
                parent[new_state] = (state, i, None)

            # Option 2: Assign to Analyst A
            if c1 + weight <= capacities[0]:

                new_state = (i + 1, c1 + weight, c2, c3)
                new_value = current_value + value

                if new_state not in new_dp or new_value > new_dp[new_state]:
                    new_dp[new_state] = new_value
                    parent[new_state] = (state, i, 0)

            # Option 3: Assign to Analyst B
            if c2 + weight <= capacities[1]:

                new_state = (i + 1, c1, c2 + weight, c3)
                new_value = current_value + value

                if new_state not in new_dp or new_value > new_dp[new_state]:
                    new_dp[new_state] = new_value
                    parent[new_state] = (state, i, 1)

            # Option 4: Assign to Analyst C
            if c3 + weight <= capacities[2]:

                new_state = (i + 1, c1, c2, c3 + weight)
                new_value = current_value + value

                if new_state not in new_dp or new_value > new_dp[new_state]:
                    new_dp[new_state] = new_value
                    parent[new_state] = (state, i, 2)

        # Update DP table
        dp = new_dp

    # Find the state with maximum evidence value
    best_state = max(dp, key=dp.get)
    maximum_value = dp[best_state]

    # Create an empty allocation for each analyst
    allocation = {
        analysts.iloc[j]["analyst_name"]: []
        for j in range(k)
    }

    # Backtracking: trace decisions from the best state
    current_state = best_state

    while current_state[0] > 0:

        previous_state, item_index, analyst_index = parent[current_state]

        # If the item was assigned, add it to that analyst
        if analyst_index is not None:

            analyst_name = analysts.iloc[analyst_index]["analyst_name"]

            allocation[analyst_name].append(
                evidence.iloc[item_index].to_dict()
            )

        current_state = previous_state

    # Reverse allocations to restore original evidence order
    for analyst_name in allocation:
        allocation[analyst_name].reverse()

    return maximum_value, allocation
