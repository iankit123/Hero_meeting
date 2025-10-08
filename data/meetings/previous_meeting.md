# Earlier Meeting Notes – Payment Failures Discussion
**Date:** 20th September 2025  
**Participants:** Matt, Tom  

**Matt:** Hey Tom, I’ve noticed some payment failures in our dashboard over the last few days. The success rate dropped from 96% to around 82%.  

**Tom:** Yeah, I checked this too. It seems to be happening mostly with credit card payments, especially through one of our gateways.  

**Matt:** That could explain why overall conversions dipped. If payments are failing at the last step, users might be abandoning before completion.  

**Tom:** Exactly. We’ll need to check with the payment provider’s API logs. Maybe a timeout or validation issue.  

**Matt:** Let’s flag this in the metrics and track recovery over the next few days. If this continues, we should consider fallback routing for that provider.  

---

**Summary:**  
Payment failures with one of the gateways likely caused drop-offs in the final purchase stage. Team will review logs and track success rate improvements.