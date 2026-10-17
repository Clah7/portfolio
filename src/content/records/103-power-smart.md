---
section: projects
depth: full
catalogue: DCL-103
order: 3
title: Power Smart
format: 12in
tagline: IoT energy anomaly detection. Bangkit Academy company capstone with Evomo; selected as Best Team.
role: Machine Learning Engineer
team: Team of 5
org: Bangkit Academy, with Evomo (a Telkom startup)
dates: Oct–Dec 2024
stage:
  kind: gallery
  device: phone
  alt: Power Smart app screens
  images:
    - src: records/power-smart/screen-1.webp
      alt: 'Real-time monitoring screen: the energy reading for one meter (0.04 kWh) above a list of the latest notifications.'
      caption: Real-time monitoring
    - src: records/power-smart/screen-2.webp
      alt: 'Monitoring detail screen: start and end date pickers above a line chart of active energy import.'
      caption: Visualization dashboard
    - src: records/power-smart/screen-3.webp
      alt: Notifications screen listing anomaly alerts for different meters, each with a date and time.
      caption: Notification alerts
    - src: records/power-smart/screen-4.webp
      alt: 'Anomaly detail screen: measurement information and energy consumption values for one flagged reading.'
      caption: Anomaly detection
summary:
  problem: Detecting anomalies in IoT energy time-series data.
  role: Machine Learning Engineer
  result: Selected as Best Team in the Bangkit Company Track Capstone with Evomo. The capstone scored 92.
stack: [Python, TensorFlow, scikit-learn, Google Cloud Run]
teamStack: [MQTT, Android]
credits:
  darren:
    - Data preprocessing.
    - Exploratory data analysis.
    - 'Built and compared three approaches on IoT energy time-series data: Isolation Forest, LSTM forecasting and an LSTM autoencoder.'
    - Model optimization.
    - Deployed the final model on Google Cloud Run.
  team:
    - 'The app, with four features: real-time monitoring, a visualization dashboard, notification alerts and anomaly detection.'
decisions:
  - topic: Which anomaly detector
    chose: Isolation Forest
    rejected: LSTM forecasting and an LSTM autoencoder (both built for comparison)
session:
  - src: records/power-smart/chart-lstm-forecast.webp
    alt: Line chart of actual and predicted energy usage over one week from the LSTM forecasting model, with its error metrics above.
    caption: 'LSTM forecasting: predicted vs actual usage (comparison model)'
cover:
  ground: '#1B1A18'
  ink: '#E9C23B'
  accents: ['#F3EDE2']
  motif: waveform
  caption: IoT ANOMALY DETECTION
---

Power Smart was a Bangkit Academy company capstone with Evomo, a Telkom startup, built by a team of 5 from different learning paths from October to December 2024. Darren was selected as the sole Machine Learning path representative out of 54 participants.

The work: data preprocessing and exploratory data analysis, then building and comparing three approaches on IoT energy time-series data (Isolation Forest, LSTM forecasting and an LSTM autoencoder), model optimization, and deploying the final model on Google Cloud Run.

The team was selected as Best Team in the Bangkit Company Track Capstone with Evomo, and the capstone scored 92.
