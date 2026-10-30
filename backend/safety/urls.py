from django.urls import path
from . import views as v

urlpatterns = [
    path("auth/register/", v.register), path("auth/login/", v.login), path("me/", v.me),
    path("contacts/", v.contacts), path("contacts/<int:pk>/", v.delete_contact),
    path("stats/", v.stats), path("ratings/", v.ratings), path("ratings/<int:pk>/", v.delete_rating),
    path("ratings/<int:pk>/report/", v.report_rating), path("spots/", v.spots), path("routes/score/", v.score_routes),
    path("share/start/", v.share_start), path("share/<str:token>/", v.share_view),
    path("share/<str:token>/update/", v.share_update), path("share/<str:token>/stop/", v.share_stop),
    path("sos/", v.sos), path("sos/<int:pk>/resolve/", v.sos_resolve),
]
