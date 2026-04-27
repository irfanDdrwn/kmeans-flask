from flask import Flask, render_template, request, jsonify
import pandas as pd
import numpy as np
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler
import os

app = Flask(__name__)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
df_global = pd.read_csv(os.path.join(BASE_DIR, "Mall_Customers.csv"))
df_global.columns = df_global.columns.str.strip()

FEATURES = ["Annual Income (k$)", "Spending Score (1-100)"]


def cluster_labels(df):
    lmap = {}
    for c in df["Cluster"].unique():
        sub = df[df["Cluster"] == c]
        inc = sub["Annual Income (k$)"].mean()
        scr = sub["Spending Score (1-100)"].mean()
        if inc >= 70 and scr >= 60:
            lmap[int(c)] = "High Income, High Spender"
        elif inc >= 70 and scr < 40:
            lmap[int(c)] = "High Income, Low Spender"
        elif inc < 45 and scr >= 60:
            lmap[int(c)] = "Low Income, High Spender"
        elif inc < 45 and scr < 40:
            lmap[int(c)] = "🪙 Low Income, Low Spender"
        else:
            lmap[int(c)] = "Average Customer"
    return lmap


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/run", methods=["POST"])
def api_run():
    k = int(request.json.get("k", 5))
    k = max(2, min(k, 10))

    df = df_global.copy()
    X = df[FEATURES].values
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    km = KMeans(n_clusters=k, init="k-means++", random_state=42, n_init=10)
    df["Cluster"] = km.fit_predict(X_scaled)

    lmap = cluster_labels(df)

    # Elbow data
    inertia = []
    for ki in range(1, 11):
        m = KMeans(n_clusters=ki, init="k-means++", random_state=42, n_init=10)
        m.fit(X_scaled)
        inertia.append(round(m.inertia_, 2))

    # Scatter per cluster
    scatter = {}
    for c in sorted(df["Cluster"].unique()):
        sub = df[df["Cluster"] == c]
        scatter[int(c)] = {
            "x": sub["Annual Income (k$)"].tolist(),
            "y": sub["Spending Score (1-100)"].tolist(),
        }

    # Stats
    stats = []
    for c in sorted(df["Cluster"].unique()):
        sub = df[df["Cluster"] == c]
        stats.append({
            "cluster": int(c),
            "label": lmap[int(c)],
            "count": int(len(sub)),
            "avg_income": round(float(sub["Annual Income (k$)"].mean()), 1),
            "avg_score": round(float(sub["Spending Score (1-100)"].mean()), 1),
        })

    # Table
    table = []
    for _, r in df.iterrows():
        table.append({
            "id": int(r["CustomerID"]),
            "gender": r["Gender"],
            "age": int(r["Age"]),
            "income": int(r["Annual Income (k$)"]),
            "score": int(r["Spending Score (1-100)"]),
            "cluster": int(r["Cluster"]),
            "label": lmap[int(r["Cluster"])],
        })

    return jsonify({
        "k": k,
        "scatter": scatter,
        "elbow": {"k_values": list(range(1, 11)), "inertia": inertia},
        "stats": stats,
        "table": table,
        "label_map": lmap,
        "total": len(df),
        "avg_income": round(float(df["Annual Income (k$)"].mean()), 1),
        "avg_score": round(float(df["Spending Score (1-100)"].mean()), 1),
    })


if __name__ == "__main__":
    import os
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5000)))
