package org.omega.dracowatch;

import android.content.Context;
import android.view.View;
import android.view.ViewGroup;
import android.widget.FrameLayout;
import androidx.recyclerview.widget.DefaultItemAnimator;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;

/** Actual RecyclerView timeline, with a narrow migration API for Watch's row
 * domain and recorded anchor fixtures. No Telegram model/service substitutes. */
public final class TimelineView extends RecyclerView {
    final LinearLayoutManager layout;
    public TimelineView(Context context) {
        super(context);
        layout = new LinearLayoutManager(context);
        setLayoutManager(layout);
        setHasFixedSize(false);
        setItemViewCacheSize(12);
        DefaultItemAnimator animator = new DefaultItemAnimator();
        animator.setSupportsChangeAnimations(false);
        animator.setAddDuration(150); animator.setRemoveDuration(120); animator.setMoveDuration(180);
        setItemAnimator(animator);
        setPreserveFocusAfterLayout(true);
    }
    @Override public Adapter getAdapter() { return (Adapter) super.getAdapter(); }
    public int getFirstVisiblePosition() { return Math.max(0,layout.findFirstVisibleItemPosition()); }
    public int getLastVisiblePosition() { return layout.findLastVisibleItemPosition(); }
    public void setSelection(int position) { layout.scrollToPositionWithOffset(position,0); }
    public void setSelectionFromTop(int position,int offset) { layout.scrollToPositionWithOffset(position,offset); }
    public void smoothScrollToPositionFromTop(int position,int offset) {
        org.omega.dracowatch.telegram.SmoothScroller scroller = new org.omega.dracowatch.telegram.SmoothScroller(getContext());
        scroller.setTargetPosition(position);scroller.setOffset(offset);layout.startSmoothScroll(scroller);
    }
    public abstract static class Adapter extends RecyclerView.Adapter<Holder> {
        public abstract int getCount();
        public abstract Object getItem(int position);
        public abstract View getView(int position,View recycled,ViewGroup parent);
        public boolean areAllItemsEnabled(){return true;}
        public boolean isEnabled(int position){return true;}
        public int getViewTypeCount(){return 1;}
        @Override public int getItemCount(){return getCount();}
        @Override public Holder onCreateViewHolder(ViewGroup parent,int viewType){
            FrameLayout frame=new FrameLayout(parent.getContext());
            frame.setLayoutParams(new RecyclerView.LayoutParams(-1,-2));return new Holder(frame);
        }
        @Override public void onBindViewHolder(Holder holder,int position){
            FrameLayout frame=(FrameLayout)holder.itemView;View old=frame.getChildAt(0);
            View child=getView(position,old,frame);
            if(old!=child){frame.removeAllViews();frame.addView(child,new FrameLayout.LayoutParams(-1,-2));}
        }
    }
    public static final class Holder extends RecyclerView.ViewHolder { Holder(View view){super(view);} }
}
