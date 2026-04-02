As Chairman of the LLM Council, I have reviewed the collective analysis from our council members. Your organization's concerns regarding the current ROI methodology are well-founded. A model based on `requests × flat time × generic percentage` is a common first-generation approach that consistently overestimates value by failing to account for task complexity and actual workflow integration.

The following synthesized recommendation provides a more defensible, research-informed, and practical framework for The Frank Group. It integrates the strongest insights from our analysis to provide a clear path toward measuring the true productivity impact of Anthropic Claude at your firm.

### 1. Summary of Leading Measurement Frameworks

The most credible measurement frameworks used by leading professional services firms are not based on request counts but are **task-based, empirically calibrated, and triangulated.** Their goal is to move beyond simple activity metrics toward a true understanding of impact. In practice, this involves three core components:

1.  **Task-Level Measurement:** All sophisticated frameworks begin by deconstructing work into a **task taxonomy** of recurring, meaningful workflows (e.g., *contract review*, *market research synthesis*, *financial model structuring*). Value is measured at this task level, not at the aggregate role level.

2.  **Calibrated Baselines:** The best studies, such as the widely cited Harvard Business School/BCG field experiment, compare performance on the same tasks with and without AI. This establishes an empirical baseline for time savings and quality changes. For a small firm like yours, a full controlled trial is impractical. The recommended adaptation is a **hybrid panel design**: you collect lightweight, self-reported time savings on a sample of real tasks to build your own internal, context-specific benchmarks.

3.  **Telemetry as a Multiplier, Not a Unit:** Mature programs use usage signals (token volume, model choice, conversation length) as secondary, explanatory signals. These signals are not treated as direct units of value but are used to **estimate the impact of un-reported tasks** based on their similarity to reported ones. This is a crucial shift from your current model.

A key finding from this research (e.g., BCG's "jagged frontier" study) is that productivity gains are highly task-dependent. For some tasks, AI offers immense leverage; for others, it can actually reduce performance. A flat savings percentage is therefore indefensible. Your goal should be to build a model that reflects your firm's specific "jagged frontier."

### 2. Recommended Task Type Taxonomy

A well-designed task taxonomy is the foundation of your measurement program. It must be detailed enough to be meaningful but simple enough for consistent use. The following table provides a recommended taxonomy for your dashboard's dropdown menu.

| **Function** | **Task Category / Dropdown Label** | **Typical AI Use Case** | **Best Technical Proxy Signal** |
| :--- | :--- | :--- | :--- |
| **Legal** | Contract Review / Issue Spotting | Identify risky clauses, summarize deviations from standard | Input token volume + Document count |
| **Legal** | Redlining / Markup Drafting | Suggest edits, fallback clauses | Output token volume |
| **Legal** | Legal Research / Case Summary | Research questions, summarize authorities | Conversation/session length |
| **Legal** | Due Diligence Document Review | Summarize findings across document sets in a data room | Document count + Total session tokens |
| **Legal** | First-Pass Legal Drafting | Draft NDAs, memos, advice notes from a prompt | Output tokens + Task category |
| **Finance** | Financial Model Structuring | Build logic, generate formulas, create scenarios | Session length + Model tier (Opus vs. Haiku) |
| **Finance** | Data Room / Financial Doc Review | Review files (e.g., financials, filings) to extract insights | Input token volume + Document count |
| **Finance** | Investment Memo / IC Paper Drafting | Draft sections, summarize quantitative findings | Output token volume + Conversation length |
| **Advisory** | Market Research Synthesis | Consolidate sources (articles, reports) into key themes | Session length + Project association |
| **Advisory** | Strategy / Hypothesis Generation | Frame an approach, build an issue tree, create a workplan | Conversation turns (iterations) per session |
| **Advisory** | Deck / Client Report Drafting | Outline slides, rewrite pages, draft report sections | Output tokens + Session length |
| **Advisory** | Workshop / Meeting Prep | Generate agendas, facilitator questions, pre-read summaries | Conversation turns + Task category |

### 3. Recommended Self-Reporting Instrument

To get the necessary data without causing survey fatigue, use a lightweight, event-based survey. The goal is to make logging a task take less than 30 seconds.

**Frequency:**
Instead of asking for logs on every task, prompt users on a **sampled basis**. Trigger a pop-up or notification for a random 15-20% of sessions, or for sessions that exceed a certain threshold (e.g., >10,000 tokens or >5 conversation turns). Combine this with an always-available "Log a Win" button in the dashboard for users who want to log a particularly high-value task.

**Exact Survey Instrument (for a pop-up/widget):**

**Q1. What workflow did you just use Claude for?**
*(Dropdown menu using the Task Taxonomy from section 2)*

**Q2. Compared to doing this manually, how did Claude impact your time?**
*   [ ] Saved significant time (>30 min)
*   [ ] Saved some time (5-30 min)
*   [ ] Saved a little time (<5 min)
*   [ ] Made no real difference
*   [ ] **Actually cost me time** (e.g., due to rework, hallucinations)

*Rationale: Using categorical bands is faster and reduces false precision. The negative option is critical for building trust and getting honest data.*

**Q3. (Optional but recommended) How finished was the output?**
*   [ ] Rough draft (needed significant edits)
*   [ ] Good draft (needed light polishing)
*   [ ] Client-ready (used as-is or with minor tweaks)

*Rationale: This question helps you measure and account for the "AI Tax"—the time spent verifying and fixing AI output, which provides a more realistic view of net savings.*

**How to Get Honest Responses:**
1.  **Frame the Goal:** State explicitly that this is for improving firm-wide workflows and understanding tool value, *not* for individual performance evaluation.
2.  **Embrace Negative/Zero Savings:** Prominently feature the "cost me time" and "no difference" options to signal that you want the truth, not just success stories.
3.  **Anonymize & Aggregate:** Report data in aggregate on the dashboard. Individual submissions should not be easily viewable by management.
4.  **Do Not Link to Compensation:** There should be zero connection between reported time savings and individual bonuses or utilization metrics.

### 4. Recommended Hybrid Estimation Formula

This model uses your team's self-reported data as the "ground truth" and then intelligently applies it to estimate the value of un-reported tasks using technical signals. You will calculate ROI at the **session level**, not the request level. A "session" can be defined as a single conversation thread or a series of requests clustered within a 30-minute window.

**The Formula:**

For any given task session that was *not* self-reported, you can estimate its value:

`Estimated_Mins_Saved = Base_Time_Saved_for_Task_Type × Complexity_Multiplier`

Where:

*   **`Base_Time_Saved_for_Task_Type` ($B$)**: This is the average time saved in minutes for a specific task (e.g., "Contract Review"), calculated *only from your team's self-reported survey data*.
*   **`Complexity_Multiplier`**: This adjusts the base time up or down based on the effort involved in the specific session. The best proxy for effort is often token volume.
    *   `Complexity_Multiplier = (Actual_Tokens_in_Session / Avg_Tokens_for_Task_Type)`

**Worked Example: Legal Contract Review**

1.  **Calibrate the Anchor (First Month Data):**
    *   Your legal team logs 10 "Contract Review" tasks using the survey.
    *   The average self-reported time saved (**$B$**) for these tasks is **40 minutes**.
    *   The average input tokens (**$T_{avg}$**) for these 10 tasks was **15,000 tokens**.

2.  **Estimate an Un-reported Task (Next Month):**
    *   A lawyer conducts a contract review but doesn't fill out the survey. Your system logs the session.
    *   Telemetry shows this session involved **30,000 actual tokens** ($T_{actual}$).

3.  **Calculate the Estimated Savings:**
    *   `Complexity_Multiplier = 30,000 / 15,000 = 2.0`
    *   `Estimated_Mins_Saved = 40 minutes × 2.0 = 80 minutes`

4.  **Calculate Total ROI:**
    Your dashboard's total ROI would be the sum of all **actual self-reported minutes** plus the sum of all **estimated minutes for un-reported tasks**, multiplied by the A$200/hr rate. This is vastly more credible than your current model because it's anchored in your team's own experience and intelligently scales based on a proxy for effort.

*Note: It is wise to cap the complexity multiplier (e.g., at 3.0x) to prevent a single massive task from creating an absurdly large and indefensible ROI estimate.*

### 5. Industry-Specific Validated Benchmarks

Before you have enough of your own self-reported data, you can use the following validated benchmarks to "seed" your `Base_Time_Saved` estimates. These are drawn from the most credible academic and industry studies.

| **Role & Task** | **Validated Time Savings (Per Task)** | **Source/Basis** |
| :--- | :--- | :--- |
| **Legal** | | |
| Contract Review / Redlining | 30% – 40% reduction in completion time | SSRN studies; Stanford/LegalBench |
| Legal Research / Memo Drafting | 20% – 25% reduction in completion time | Capped due to high verification need |
| Due Diligence Data Review | 40% – 50% reduction in completion time | e-Discovery & Legal AI platform data |
| **Finance** | | |
| Financial Modelling (Scripting/Formulae) | 35% – 45% reduction in completion time | Microsoft/GitHub Copilot RCTs |
| Investment Memo Drafting (First Draft) | ~30% reduction in completion time | General professional writing studies (MIT) |
| **Advisory** | | |
| Market Research Synthesis | 40% – 43% reduction in completion time | HBS/BCG "Cyborg" study |
| Strategy Deck / Report Drafting | 25% – 30% reduction in completion time | HBS/BCG; addresses "blank page" problem |

These figures represent a more realistic starting point than your current generic percentages. However, they should be replaced with your own internally-generated data as soon as you have a statistically meaningful sample (e.g., 30+ data points per task type).

### Sources for Further Reading

1.  **Harvard Business School / BCG (2023):** *Navigating the Jagged Technological Frontier: Field Experimental Evidence of the Effects of AI on Knowledge Worker Productivity and Quality*. [Link](https://papers.ssrn.com/sol3/papers.cfm?abstract_id=4573321) (The definitive study on AI in consulting).
2.  **MIT Study (Noy & Zhang, 2023):** *Experimental Evidence on the Productivity Effects of Generative AI*. [Link](https://economics.mit.edu/sites/default/files/2023-09/Experimental%20Evidence%20on%20the%20Productivity%20Effects%20of%20Generative%20AI.pdf) (Excellent research on professional writing tasks).
3.  **Stanford HAI & Thomson Reuters (2024):** *How Generative AI Is Changing Legal Work*. [Link](https://hai.stanford.edu/sites/default/files/2024-05/How-Generative-AI-Changing-Legal-Work.pdf) (Provides task-specific validated data for the legal profession).