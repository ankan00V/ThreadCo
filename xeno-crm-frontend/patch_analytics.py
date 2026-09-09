import re

with open("../xeno-crm-backend/app/routers/analytics.py", "r") as f:
    content = f.read()

# We need to add the calculation for marketing metrics to analytics_overview

# Find where `active_campaigns = ...` is
# and insert our new metrics calculations.

new_metrics = """
    # --- Marketing Metrics ---
    campaign_stats = db.query(
        func.sum(Campaign.total_sent).label('total_sent'),
        func.sum(Campaign.total_opened).label('total_opened'),
        func.sum(Campaign.total_clicked).label('total_clicked')
    ).one()
    
    total_sent = campaign_stats.total_sent or 0
    total_opened = campaign_stats.total_opened or 0
    total_clicked = campaign_stats.total_clicked or 0
    
    avg_open_rate = (total_opened / total_sent * 100) if total_sent > 0 else 0
    click_through = (total_clicked / total_opened * 100) if total_opened > 0 else 0
    
    total_revenue = db.query(func.sum(Order.amount)).filter(Order.status == "completed").scalar() or 0
    revenue_per_msg = (total_revenue / total_sent) if total_sent > 0 else 0

    channel_stats = db.query(
        Campaign.channel,
        func.sum(Campaign.total_sent).label('sent')
    ).group_by(Campaign.channel).all()
    
    channel_counts = {row.channel: (row.sent or 0) for row in channel_stats}
    channel_wa = (channel_counts.get('whatsapp', 0) / total_sent * 100) if total_sent > 0 else 0
    channel_email = (channel_counts.get('email', 0) / total_sent * 100) if total_sent > 0 else 0
    channel_sms = (channel_counts.get('sms', 0) / total_sent * 100) if total_sent > 0 else 0
    # -------------------------
"""

# Now we need to inject this block before lapsed_high_value
content = content.replace("lapsed_high_value = (", new_metrics + "\n    lapsed_high_value = (")

# Now add these keys to the returned dict
return_dict_update = """
        "avg_open_rate": round(avg_open_rate, 1),
        "click_through": round(click_through, 1),
        "revenue_per_msg": round(revenue_per_msg, 2),
        "channel_wa": round(channel_wa, 1),
        "channel_email": round(channel_email, 1),
        "channel_sms": round(channel_sms, 1),
        "query_health": _audience_query_health(db),
"""
content = content.replace('"query_health": _audience_query_health(db),', return_dict_update)

with open("../xeno-crm-backend/app/routers/analytics.py", "w") as f:
    f.write(content)

